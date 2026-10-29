//! Running Deplug elevated (Windows only): detection, relaunch and the startup hand-over.

/// Command line flag the elevated copy receives: the pid of the instance that launched it.
pub const ELEVATED_FROM_FLAG: &str = "--elevated-from";
/// How long the new instance waits for the old one to exit.
pub const WAIT_TIMEOUT_MS: u32 = 15_000;

/// Reads `--elevated-from <pid>` (or `--elevated-from=<pid>`) from the arguments.
pub fn parse_elevated_from<S: AsRef<str>>(args: &[S]) -> Option<u32> {
    let mut it = args.iter().map(AsRef::as_ref);
    while let Some(arg) = it.next() {
        if arg == ELEVATED_FROM_FLAG {
            return it.next().and_then(|v| v.parse().ok());
        }
        if let Some(v) = arg.strip_prefix("--elevated-from=") {
            return v.parse().ok();
        }
    }
    None
}

/// Whether startup should relaunch elevated. The flag check prevents relaunch loops.
pub fn should_relaunch(
    run_as_admin: bool,
    elevated: bool,
    has_flag: bool,
    is_windows: bool,
) -> bool {
    is_windows && run_as_admin && !elevated && !has_flag
}

#[cfg(windows)]
mod imp {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows_sys::Win32::Storage::FileSystem::SYNCHRONIZE;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, OpenProcessToken, WaitForSingleObject,
    };
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn wide(s: &std::ffi::OsStr) -> Vec<u16> {
        s.encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn is_elevated() -> bool {
        // SAFETY: plain Win32 calls on our own process token; the handle is closed below.
        unsafe {
            let mut token: HANDLE = std::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return false;
            }
            let mut info = TOKEN_ELEVATION { TokenIsElevated: 0 };
            let mut len = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                &mut info as *mut _ as *mut _,
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut len,
            );
            CloseHandle(token);
            ok != 0 && info.TokenIsElevated != 0
        }
    }

    pub fn relaunch_elevated(wait_pid: u32) -> Result<(), String> {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let verb = wide("runas".as_ref());
        let file = wide(exe.as_os_str());
        let params = wide(format!("{} {wait_pid}", super::ELEVATED_FROM_FLAG).as_ref());
        // SAFETY: all strings are NUL-terminated and outlive the call.
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                file.as_ptr(),
                params.as_ptr(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };
        // Per the ShellExecute contract, values up to 32 are error codes (5 = declined/denied).
        let code = result as usize;
        if code > 32 {
            Ok(())
        } else {
            Err(format!("ShellExecuteW failed with code {code}"))
        }
    }

    pub fn wait_for_exit(pid: u32, timeout_ms: u32) {
        // SAFETY: failures are ignored; the handle is closed when it was opened.
        unsafe {
            let handle = OpenProcess(SYNCHRONIZE, 0, pid);
            if handle.is_null() {
                return;
            }
            WaitForSingleObject(handle, timeout_ms);
            CloseHandle(handle);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn is_elevated() -> bool {
        false
    }

    pub fn relaunch_elevated(_wait_pid: u32) -> Result<(), String> {
        Err("Elevated relaunch is only available on Windows".to_string())
    }

    pub fn wait_for_exit(_pid: u32, _timeout_ms: u32) {}
}

/// True when the process runs with administrator rights (always false off Windows).
pub fn is_elevated() -> bool {
    imp::is_elevated()
}

/// Starts a new elevated copy of this executable through UAC (verb `runas`).
/// An error (e.g. UAC declined) means nothing was started.
pub fn relaunch_elevated(wait_pid: u32) -> Result<(), String> {
    imp::relaunch_elevated(wait_pid)
}

/// Waits (best effort, up to `timeout_ms`) for process `pid` to exit.
pub fn wait_for_exit(pid: u32, timeout_ms: u32) {
    imp::wait_for_exit(pid, timeout_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_flag_forms() {
        assert_eq!(
            parse_elevated_from(&["app.exe", "--elevated-from", "1234"]),
            Some(1234)
        );
        assert_eq!(
            parse_elevated_from(&["app.exe", "--elevated-from=77"]),
            Some(77)
        );
    }

    #[test]
    fn ignores_missing_or_bad_values() {
        assert_eq!(parse_elevated_from::<&str>(&[]), None);
        assert_eq!(parse_elevated_from(&["app.exe", "--other"]), None);
        assert_eq!(parse_elevated_from(&["app.exe", "--elevated-from"]), None);
        assert_eq!(
            parse_elevated_from(&["app.exe", "--elevated-from", "abc"]),
            None
        );
        assert_eq!(
            parse_elevated_from(&["app.exe", "--elevated-from", "-1"]),
            None
        );
    }

    #[test]
    fn relaunch_decision() {
        assert!(should_relaunch(true, false, false, true));
        assert!(!should_relaunch(false, false, false, true));
        assert!(!should_relaunch(true, true, false, true));
        assert!(!should_relaunch(true, false, true, true));
        assert!(!should_relaunch(true, false, false, false));
    }

    #[test]
    fn not_elevated_off_windows() {
        if cfg!(not(windows)) {
            assert!(!is_elevated());
            assert!(relaunch_elevated(1).is_err());
        }
    }
}
