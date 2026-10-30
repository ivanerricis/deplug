//! Plugin uninstall backend: move plugins to the trash and create restore points.

use std::ffi::OsString;
use std::path::{Component, Path};
use std::sync::Mutex;

use tauri::State;

use crate::portable::AppMode;

const PLUGIN_EXTENSIONS: [&str; 7] = ["dll", "vst", "vst3", "aaxplugin", "component", "so", "clap"];

/// Strictly validates a path before it is trashed.
pub fn validate_plugin_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("ERR_INVALID_PATH".into());
    }
    let normal_count = path
        .components()
        .filter(|c| matches!(c, Component::Normal(_)))
        .count();
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("ERR_INVALID_PATH".into());
    }
    if path.parent().is_none() || path.file_name().is_none() {
        return Err("ERR_INVALID_PATH".into());
    }
    if let Some(home) = home_dir() {
        if path == home {
            return Err("ERR_INVALID_PATH".into());
        }
    }
    // Absolute path: root/prefix components plus at least 3 total components.
    if path.components().count() < 3 || normal_count < 1 {
        return Err("ERR_INVALID_PATH".into());
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("ERR_INVALID_PATH")?;
    let ext_ok = name.rsplit_once('.').is_some_and(|(stem, ext)| {
        !stem.is_empty()
            && PLUGIN_EXTENSIONS
                .iter()
                .any(|e| e.eq_ignore_ascii_case(ext))
    });
    if !ext_ok {
        return Err("ERR_INVALID_PATH".into());
    }
    if !path.exists() {
        return Err("ERR_NOT_FOUND".into());
    }
    Ok(())
}

fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(Into::into)
}

/// Serializes the temporary environment swap done by `trash_with_system_env`.
static TRASH_ENV_LOCK: Mutex<()> = Mutex::new(());

/// Moves `path` to the system trash. In portable mode on Linux `XDG_DATA_HOME` points into
/// the app's data folder, which would hide the trashed file inside it, so the original value is
/// put back for the duration of the call.
pub(crate) fn trash_with_system_env(
    path: &Path,
    redirected: bool,
    original: &Option<OsString>,
) -> Result<(), trash::Error> {
    if !redirected {
        return trash::delete(path);
    }
    let _guard = TRASH_ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let current = std::env::var_os("XDG_DATA_HOME");
    match original {
        Some(v) => std::env::set_var("XDG_DATA_HOME", v),
        None => std::env::remove_var("XDG_DATA_HOME"),
    }
    let result = trash::delete(path);
    match current {
        Some(v) => std::env::set_var("XDG_DATA_HOME", v),
        None => std::env::remove_var("XDG_DATA_HOME"),
    }
    result
}

/// True when a trash error message means the OS refused the operation for lack of permissions.
/// The `trash` crate reports a denied Recycle Bin move on Windows as "Some operations were aborted".
pub fn is_access_denied(err: &str) -> bool {
    let l = err.to_lowercase();
    [
        "some operations were aborted",
        "access is denied",
        "os error 5",
        "permission denied",
    ]
    .iter()
    .any(|needle| l.contains(needle))
}

/// Maps a trash failure to a stable code: access-denied (Windows only, where an elevated retry
/// can help) becomes `ERR_TRASH_ACCESS_DENIED`, anything else keeps its detail.
pub fn map_trash_error(detail: &str, windows: bool) -> String {
    if windows && is_access_denied(detail) {
        "ERR_TRASH_ACCESS_DENIED".into()
    } else {
        format!("ERR_TRASH_FAILED:{detail}")
    }
}

#[tauri::command]
pub async fn trash_plugin(path: String, mode: State<'_, AppMode>) -> Result<(), String> {
    let p = std::path::PathBuf::from(path);
    let redirected = cfg!(target_os = "linux") && mode.portable;
    let original = mode.original_xdg_data_home.clone();
    tauri::async_runtime::spawn_blocking(move || {
        validate_plugin_path(&p)?;
        trash_with_system_env(&p, redirected, &original)
            .map_err(|e| map_trash_error(&e.to_string(), cfg!(windows)))
    })
    .await
    .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

/// Maps a permanent-delete failure to a stable code, like `map_trash_error` (access-denied on
/// Windows becomes `ERR_DELETE_ACCESS_DENIED`, which an elevated retry can fix).
pub fn map_delete_error(detail: &str, windows: bool) -> String {
    if windows && is_access_denied(detail) {
        "ERR_DELETE_ACCESS_DENIED".into()
    } else {
        format!("ERR_DELETE_FAILED:{detail}")
    }
}

/// Deletes a file or folder for good. A symlink is removed itself, never followed.
pub(crate) fn remove_permanently(path: &Path) -> std::io::Result<()> {
    let meta = std::fs::symlink_metadata(path)?;
    if meta.is_dir() {
        std::fs::remove_dir_all(path)
    } else if meta.file_type().is_symlink() {
        // A directory symlink on Windows must be removed with remove_dir.
        std::fs::remove_file(path).or_else(|_| std::fs::remove_dir(path))
    } else {
        std::fs::remove_file(path)
    }
}

/// Deletes a plugin for good (no Recycle Bin), under exactly the same path rules as `trash_plugin`.
#[tauri::command]
pub async fn delete_plugin_permanently(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(path);
    tauri::async_runtime::spawn_blocking(move || {
        validate_plugin_path(&p)?;
        remove_permanently(&p).map_err(|e| map_delete_error(&e.to_string(), cfg!(windows)))
    })
    .await
    .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

/// Keeps only safe characters and limits the length to 100 chars.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn sanitize_description(desc: &str) -> String {
    let cleaned: String = desc
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.' | '(' | ')') {
                c
            } else {
                ' '
            }
        })
        .collect();
    let collapsed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let limited: String = collapsed.chars().take(100).collect();
    let limited = limited.trim().to_string();
    if limited.is_empty() {
        "Deplug".to_string()
    } else {
        limited
    }
}

/// Maps PowerShell output / exit code to a stable machine error code.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn map_restore_error(output: &str, code: Option<i32>) -> String {
    let l = output.to_lowercase();
    if l.contains("1440")
        || l.contains("24 hours")
        || l.contains("frequency")
        || l.contains("24 ore")
    {
        "ERR_RESTORE_FREQUENCY".into()
    } else if l.contains("disabled")
        || l.contains("protezione sistema")
        || l.contains("system protection")
        || l.contains("not enabled")
    {
        "ERR_RESTORE_PROTECTION_DISABLED".into()
    } else {
        let exit = code.map_or_else(|| "exit ?".to_string(), |c| format!("exit {c}"));
        let detail: String = output.trim().chars().take(300).collect();
        if detail.is_empty() {
            format!("ERR_RESTORE_FAILED:{exit}")
        } else {
            format!("ERR_RESTORE_FAILED:{exit}: {detail}")
        }
    }
}

#[cfg(windows)]
fn create_restore_point_blocking(description: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let desc = sanitize_description(description);
    let log = std::env::temp_dir().join(format!("pu-restore-{}.log", std::process::id()));
    let _ = std::fs::remove_file(&log);
    let log_str = log.to_string_lossy().replace('\'', "''");

    // Inner script: description is sanitized (no quotes), log path is escaped.
    let inner = format!(
        "$ErrorActionPreference='Stop'; try {{ Checkpoint-Computer -Description '{desc}' -RestorePointType MODIFY_SETTINGS 3>&1 2>&1 | Out-String | Set-Content -LiteralPath '{log_str}' -Encoding UTF8; exit 0 }} catch {{ ($_ | Out-String) | Set-Content -LiteralPath '{log_str}' -Encoding UTF8; exit 1 }}"
    );
    // Pass inner script to the elevated process as base64 -EncodedCommand (UTF-16LE).
    let utf16: Vec<u8> = inner.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let encoded = base64_encode(&utf16);

    let outer = format!(
        "$p = Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','{encoded}'; exit $p.ExitCode"
    );

    let out = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &outer])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("ERR_RESTORE_FAILED:{e}"))?;

    let file_out = std::fs::read(&log)
        .ok()
        .map(|b| {
            String::from_utf8_lossy(&b)
                .trim_start_matches('\u{feff}')
                .to_string()
        })
        .unwrap_or_default();
    let _ = std::fs::remove_file(&log);
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();

    if out.status.success() {
        return Ok(());
    }
    let sl = stderr.to_lowercase();
    if sl.contains("canceled by the user") || sl.contains("annullata dall'utente") {
        return Err("ERR_RESTORE_UAC_CANCELLED".into());
    }
    let combined = format!("{file_out}\n{stderr}");
    Err(map_restore_error(&combined, out.status.code()))
}

#[cfg_attr(not(windows), allow(dead_code))]
fn base64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        s.push(T[(n >> 18) as usize & 63] as char);
        s.push(T[(n >> 12) as usize & 63] as char);
        s.push(if chunk.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        s.push(if chunk.len() > 2 {
            T[n as usize & 63] as char
        } else {
            '='
        });
    }
    s
}

/// Maximum number of paths accepted by one elevated trash call.
#[cfg_attr(not(windows), allow(dead_code))]
const MAX_ELEVATED_PATHS: usize = 100;
/// Upper bound for the base64 script so the elevated command line stays under the Windows limit.
#[cfg_attr(not(windows), allow(dead_code))]
const MAX_ENCODED_SCRIPT_LEN: usize = 30_000;

/// Quotes a string as a PowerShell single-quoted literal. Besides `'`, PowerShell also treats the
/// typographic quotes U+2018, U+2019, U+201A and U+201B as quote characters, so all are doubled.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn ps_quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        out.push(c);
        if matches!(c, '\'' | '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}') {
            out.push(c);
        }
    }
    out.push('\'');
    out
}

/// Builds the PowerShell script that sends every path to the Recycle Bin. Each result is
/// appended to `log_path` as `OK|<index>` or `ERR|<index>|<message>`; paths never reach the log.
/// The paths are embedded as literals: the elevated process must never read them from a file
/// a normal user could modify.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn build_trash_script(paths: &[String], log_path: &str) -> String {
    let list = paths
        .iter()
        .map(|p| ps_quote(p))
        .collect::<Vec<_>>()
        .join(",");
    let log = ps_quote(log_path);
    format!(
        "$ErrorActionPreference='Stop'; Add-Type -AssemblyName Microsoft.VisualBasic; \
$log={log}; $paths=@({list}); \
for($i=0; $i -lt $paths.Count; $i++) {{ $p=$paths[$i]; \
try {{ \
if(Test-Path -LiteralPath $p -PathType Container) {{ [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p,'OnlyErrorDialogs','SendToRecycleBin') }} \
elseif(Test-Path -LiteralPath $p -PathType Leaf) {{ [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin') }} \
else {{ throw 'Path not found' }}; \
Add-Content -LiteralPath $log -Value \"OK|$i\" -Encoding UTF8 \
}} catch {{ \
$m=($_.Exception.Message -replace '[\\r\\n|]+',' '); \
Add-Content -LiteralPath $log -Value \"ERR|$i|$m\" -Encoding UTF8 \
}} }}; exit 0"
    )
}

/// Builds the PowerShell script that deletes every path for good (`Remove-Item -Recurse -Force`),
/// logging like `build_trash_script`. Paths are embedded as quoted literals, never read from a file.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn build_delete_script(paths: &[String], log_path: &str) -> String {
    let list = paths
        .iter()
        .map(|p| ps_quote(p))
        .collect::<Vec<_>>()
        .join(",");
    let log = ps_quote(log_path);
    format!(
        "$ErrorActionPreference='Stop'; \
$log={log}; $paths=@({list}); \
for($i=0; $i -lt $paths.Count; $i++) {{ $p=$paths[$i]; \
try {{ \
if(Test-Path -LiteralPath $p) {{ Remove-Item -LiteralPath $p -Recurse -Force }} \
else {{ throw 'Path not found' }}; \
Add-Content -LiteralPath $log -Value \"OK|$i\" -Encoding UTF8 \
}} catch {{ \
$m=($_.Exception.Message -replace '[\\r\\n|]+',' '); \
Add-Content -LiteralPath $log -Value \"ERR|$i|$m\" -Encoding UTF8 \
}} }}; exit 0"
    )
}

/// Reads the log written by the elevated script. Returns one `ERR_TRASH_FAILED(<message>):<path>`
/// entry per failed path; a path with no `OK` line (missing or garbled log) counts as failed.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn parse_trash_log(log: &str, paths: &[String]) -> Vec<String> {
    parse_op_log(log, paths, "ERR_TRASH_FAILED")
}

/// Same as `parse_trash_log` with the failure code of the operation (`ERR_TRASH_FAILED` or `ERR_DELETE_FAILED`).
#[cfg_attr(not(windows), allow(dead_code))]
pub fn parse_op_log(log: &str, paths: &[String], code: &str) -> Vec<String> {
    let mut status: Vec<Option<Result<(), String>>> = vec![None; paths.len()];
    for line in log.lines() {
        let line = line.trim().trim_start_matches('\u{feff}');
        let mut parts = line.splitn(3, '|');
        let (Some(kind), Some(idx)) = (parts.next(), parts.next()) else {
            continue;
        };
        let Ok(i) = idx.trim().parse::<usize>() else {
            continue;
        };
        let Some(slot) = status.get_mut(i) else {
            continue;
        };
        match kind {
            "OK" => *slot = Some(Ok(())),
            "ERR" => {
                let msg: String = parts
                    .next()
                    .unwrap_or("")
                    .replace(['(', ')'], " ")
                    .trim()
                    .chars()
                    .take(200)
                    .collect();
                *slot = Some(Err(if msg.is_empty() {
                    "unknown error".to_string()
                } else {
                    msg
                }));
            }
            _ => {}
        }
    }
    paths
        .iter()
        .zip(status)
        .filter_map(|(path, st)| match st {
            Some(Ok(())) => None,
            Some(Err(msg)) => Some(format!("{code}({msg}):{path}")),
            None => Some(format!("{code}(no result):{path}")),
        })
        .collect()
}

/// Rejects paths that cannot be embedded safely in a script literal (NUL, newlines, control chars).
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn check_script_safe(paths: &[String]) -> Result<(), String> {
    if paths.iter().any(|p| p.chars().any(char::is_control)) {
        return Err("ERR_INVALID_PATH".into());
    }
    Ok(())
}

/// What the elevated script does with each path.
#[cfg_attr(not(windows), allow(dead_code))]
#[derive(Clone, Copy)]
enum ElevatedOp {
    Trash,
    Delete,
}

/// Builds the command that runs `inner` in an elevated, hidden PowerShell: the script travels as a
/// UTF-16LE base64 `-EncodedCommand`. Fails when the whole command line would exceed the Windows
/// limit (about 32,000 characters) because of the encoded script.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn elevated_launch_command(inner: &str) -> Result<String, String> {
    let utf16: Vec<u8> = inner.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let encoded = base64_encode(&utf16);
    if encoded.len() > MAX_ENCODED_SCRIPT_LEN {
        return Err("ERR_INVALID_PATH".into());
    }
    Ok(format!(
        "$p = Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','{encoded}'; exit $p.ExitCode"
    ))
}

/// Runs the script produced by `build_script(log_path)` elevated (one UAC prompt) and returns the
/// log the script appended to. The log has an unpredictable name; it is created here (create_new
/// fails if something is already there) and the elevated script only appends to it. It is output
/// only, never read as input.
#[cfg(windows)]
pub(crate) fn run_elevated_logged(
    build_script: impl FnOnce(&str) -> String,
) -> Result<String, String> {
    use std::hash::{BuildHasher, Hasher};
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let nonce = std::collections::hash_map::RandomState::new()
        .build_hasher()
        .finish();
    let log =
        std::env::temp_dir().join(format!("pu-trash-{}-{nonce:016x}.log", std::process::id()));
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&log)
        .map_err(|e| format!("ERR_INTERNAL:{e}"))?;
    let log_str = log.to_string_lossy().to_string();

    let inner = build_script(&log_str);
    let outer = match elevated_launch_command(&inner) {
        Ok(o) => o,
        Err(e) => {
            let _ = std::fs::remove_file(&log);
            return Err(e);
        }
    };

    let out = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &outer])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    let content = std::fs::read(&log)
        .map(|b| String::from_utf8_lossy(&b).to_string())
        .unwrap_or_default();
    let _ = std::fs::remove_file(&log);
    let out = out.map_err(|e| format!("ERR_INTERNAL:{e}"))?;

    let stderr = String::from_utf8_lossy(&out.stderr).to_lowercase();
    let cancelled =
        stderr.contains("canceled by the user") || stderr.contains("annullata dall'utente");
    if cancelled || (!out.status.success() && content.trim().is_empty()) {
        return Err(if cancelled {
            "ERR_ELEVATION_CANCELLED".into()
        } else {
            format!(
                "ERR_INTERNAL:elevated process exited with {:?}",
                out.status.code()
            )
        });
    }
    Ok(content)
}

/// Elevated trash or delete of plugin paths shared by the Windows helpers.
#[cfg(windows)]
fn elevated_blocking(paths: Vec<String>, op: ElevatedOp) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    if paths.len() > MAX_ELEVATED_PATHS {
        return Err("ERR_INVALID_PATH".into());
    }
    check_script_safe(&paths)?;
    for p in &paths {
        validate_plugin_path(Path::new(p))?;
    }
    let content = run_elevated_logged(|log| match op {
        ElevatedOp::Trash => build_trash_script(&paths, log),
        ElevatedOp::Delete => build_delete_script(&paths, log),
    })?;
    Ok(match op {
        ElevatedOp::Trash => parse_trash_log(&content, &paths),
        ElevatedOp::Delete => parse_op_log(&content, &paths, "ERR_DELETE_FAILED"),
    })
}

/// Sends the given plugins to the Recycle Bin from an elevated PowerShell (one UAC prompt).
/// Returns one `<code>:<path>` entry per failed path; an empty list means all were moved.
#[tauri::command]
pub async fn trash_plugins_elevated(paths: Vec<String>) -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || elevated_blocking(paths, ElevatedOp::Trash))
            .await
            .map_err(|e| format!("ERR_INTERNAL:{e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = paths;
        Err("ERR_ELEVATION_UNSUPPORTED".into())
    }
}

/// Deletes the given plugins for good from an elevated PowerShell (one UAC prompt), under the
/// same rules as `trash_plugins_elevated`. Returns one `<code>:<path>` entry per failed path.
#[tauri::command]
pub async fn delete_plugins_elevated(paths: Vec<String>) -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || elevated_blocking(paths, ElevatedOp::Delete))
            .await
            .map_err(|e| format!("ERR_INTERNAL:{e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = paths;
        Err("ERR_ELEVATION_UNSUPPORTED".into())
    }
}

#[tauri::command]
pub async fn create_restore_point(description: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || create_restore_point_blocking(&description))
            .await
            .map_err(|e| format!("ERR_INTERNAL:{e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = description;
        Err("ERR_RESTORE_UNSUPPORTED".into())
    }
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "linux")]
    #[test]
    fn portable_trash_uses_the_original_data_home() {
        use super::*;
        let dir = std::env::temp_dir().join(format!("deplug-trash-test-{}", std::process::id()));
        let original = dir.join("system-data");
        let redirected = dir.join("portable-data");
        std::fs::create_dir_all(&original).unwrap();
        std::fs::create_dir_all(&redirected).unwrap();
        let file = dir.join("Plugin.vst3");
        std::fs::write(&file, b"x").unwrap();

        std::env::set_var("XDG_DATA_HOME", &redirected);
        trash_with_system_env(&file, true, &Some(original.clone().into())).unwrap();

        assert!(!file.exists());
        assert!(original.join("Trash/files/Plugin.vst3").exists());
        assert!(!redirected.join("Trash").exists());
        assert_eq!(std::env::var_os("XDG_DATA_HOME"), Some(redirected.into()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    use super::*;
    use std::path::PathBuf;

    fn tmp_plugin(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pu-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join(name);
        std::fs::write(&p, b"x").unwrap();
        p
    }

    #[test]
    fn accepts_valid_plugins() {
        for n in [
            "a.dll",
            "b.VST3",
            "c.vst",
            "d.aaxplugin",
            "e.clap",
            "e.component",
            "f.so",
        ] {
            assert!(validate_plugin_path(&tmp_plugin(n)).is_ok(), "{n}");
        }
    }

    #[test]
    fn rejects_bad_extension() {
        assert!(validate_plugin_path(&tmp_plugin("a.txt")).is_err());
        assert!(validate_plugin_path(&tmp_plugin("dll")).is_err());
    }

    #[test]
    fn rejects_with_stable_codes() {
        assert_eq!(
            validate_plugin_path(Path::new("foo/bar/a.dll")),
            Err("ERR_INVALID_PATH".to_string())
        );
        assert_eq!(
            validate_plugin_path(Path::new("/nonexistent/dir/a.dll")),
            Err("ERR_NOT_FOUND".to_string())
        );
    }

    #[test]
    fn rejects_relative_missing_and_roots() {
        assert!(validate_plugin_path(Path::new("foo/bar/a.dll")).is_err());
        assert!(validate_plugin_path(Path::new("/nonexistent/dir/a.dll")).is_err());
        assert!(validate_plugin_path(Path::new("/")).is_err());
        assert!(validate_plugin_path(Path::new("/a.dll")).is_err());
        assert!(validate_plugin_path(Path::new("/tmp/../etc/a.dll")).is_err());
        if let Some(h) = home_dir() {
            assert!(validate_plugin_path(&h).is_err());
        }
    }

    #[test]
    fn detects_access_denied() {
        assert!(is_access_denied(
            "Error during a `trash` operation: Unknown { description: \"Some operations were aborted\" }"
        ));
        assert!(is_access_denied("Access is denied. (os error 5)"));
        assert!(is_access_denied("PERMISSION DENIED"));
        assert!(!is_access_denied("The file is in use"));
        assert_eq!(
            map_trash_error("Some operations were aborted", true),
            "ERR_TRASH_ACCESS_DENIED"
        );
        assert_eq!(
            map_trash_error("Some operations were aborted", false),
            "ERR_TRASH_FAILED:Some operations were aborted"
        );
        assert_eq!(map_trash_error("busy", true), "ERR_TRASH_FAILED:busy");
    }

    #[test]
    fn quotes_powershell_literals() {
        assert_eq!(ps_quote("a b"), "'a b'");
        assert_eq!(ps_quote("it's"), "'it''s'");
        assert_eq!(
            ps_quote("\u{2018}x\u{2019}"),
            "'\u{2018}\u{2018}x\u{2019}\u{2019}'"
        );
        assert_eq!(ps_quote("[a]$(x)`"), "'[a]$(x)`'");
        assert_eq!(ps_quote("Plügin 音.vst3"), "'Plügin 音.vst3'");
    }

    #[test]
    fn builds_trash_script() {
        let paths = vec![
            "C:\\Program Files\\Common Files\\VST3\\O'Neil [x].vst3".to_string(),
            "C:\\Plug\u{fc}\\a.dll".to_string(),
        ];
        let s = build_trash_script(&paths, "C:\\Temp\\l.log");
        assert!(s.contains(
            "'C:\\Program Files\\Common Files\\VST3\\O''Neil [x].vst3','C:\\Plug\u{fc}\\a.dll'"
        ));
        assert!(s.contains("DeleteDirectory($p,'OnlyErrorDialogs','SendToRecycleBin')"));
        assert!(s.contains("DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')"));
        assert!(s.contains("Test-Path -LiteralPath"));
        assert!(s.contains("$log='C:\\Temp\\l.log'"));
        assert!(s.contains("OK|$i") && s.contains("ERR|$i|"));
    }

    #[test]
    fn maps_delete_errors() {
        assert_eq!(
            map_delete_error("Access is denied. (os error 5)", true),
            "ERR_DELETE_ACCESS_DENIED"
        );
        assert_eq!(
            map_delete_error("Access is denied. (os error 5)", false),
            "ERR_DELETE_FAILED:Access is denied. (os error 5)"
        );
        assert_eq!(map_delete_error("in use", true), "ERR_DELETE_FAILED:in use");
    }

    #[test]
    fn builds_delete_script() {
        let paths = vec![
            "C:\\Program Files\\VST3\\O'Neil [x].vst3".to_string(),
            "C:\\Plug\\a.dll".to_string(),
        ];
        let s = build_delete_script(&paths, "C:\\Temp\\l.log");
        assert!(s.contains("'C:\\Program Files\\VST3\\O''Neil [x].vst3','C:\\Plug\\a.dll'"));
        assert!(s.contains("Remove-Item -LiteralPath $p -Recurse -Force"));
        assert!(s.contains("Test-Path -LiteralPath"));
        assert!(s.contains("$log='C:\\Temp\\l.log'"));
        assert!(s.contains("OK|$i") && s.contains("ERR|$i|"));
        assert!(!s.contains("SendToRecycleBin"));
    }

    #[test]
    fn parses_delete_log_with_its_own_code() {
        let paths: Vec<String> = ["C:\\a.dll", "C:\\b.vst3"].map(String::from).to_vec();
        assert_eq!(
            parse_op_log("OK|0\nERR|1|In use", &paths, "ERR_DELETE_FAILED"),
            vec!["ERR_DELETE_FAILED(In use):C:\\b.vst3".to_string()]
        );
    }

    #[test]
    fn deletes_files_and_folders_permanently() {
        let dir = std::env::temp_dir().join(format!("pu-del-{}", std::process::id()));
        let bundle = dir.join("B.vst3");
        std::fs::create_dir_all(bundle.join("Contents/x64")).unwrap();
        std::fs::write(bundle.join("Contents/x64/B.vst3"), b"x").unwrap();
        let file = dir.join("a.dll");
        std::fs::write(&file, b"x").unwrap();
        assert!(validate_plugin_path(&bundle).is_ok());
        remove_permanently(&bundle).unwrap();
        remove_permanently(&file).unwrap();
        assert!(!bundle.exists() && !file.exists());
        assert!(remove_permanently(&file).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn deleting_a_symlink_keeps_its_target() {
        let dir = std::env::temp_dir().join(format!("pu-del-link-{}", std::process::id()));
        let target = dir.join("target");
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(target.join("keep.txt"), b"x").unwrap();
        let link = dir.join("L.vst3");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        remove_permanently(&link).unwrap();
        assert!(!link.exists());
        assert!(target.join("keep.txt").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn parses_trash_log() {
        let paths: Vec<String> = ["C:\\a.dll", "C:\\b.vst3", "C:\\c.dll", "C:\\d.dll"]
            .map(String::from)
            .to_vec();
        let log = "\u{feff}OK|0\nERR|1|Boom (bad)\ngarbage\nOK|x\nOK|99\nERR|3\n";
        assert_eq!(
            parse_trash_log(log, &paths),
            vec![
                "ERR_TRASH_FAILED(Boom  bad):C:\\b.vst3".to_string(),
                "ERR_TRASH_FAILED(no result):C:\\c.dll".to_string(),
                "ERR_TRASH_FAILED(unknown error):C:\\d.dll".to_string(),
            ]
        );
        assert!(parse_trash_log("OK|0\nOK|1", &paths[..2]).is_empty());
        assert_eq!(parse_trash_log("", &paths[..1]).len(), 1);
    }

    #[test]
    fn rejects_control_chars_in_script_paths() {
        assert!(check_script_safe(&["C:\\a.dll".into()]).is_ok());
        assert!(check_script_safe(&["C:\\a\n.dll".into()]).is_err());
        assert!(check_script_safe(&["C:\\a\0.dll".into()]).is_err());
    }

    #[test]
    fn sanitizes_description() {
        assert_eq!(
            sanitize_description("Rimozione 'x'; rm -rf $(a)"),
            "Rimozione x rm -rf (a)"
        );
        assert_eq!(sanitize_description("  ;;'\"`$  "), "Deplug");
        assert_eq!(sanitize_description(&"a".repeat(300)).chars().count(), 100);
    }

    #[test]
    fn maps_errors() {
        assert_eq!(
            map_restore_error("frequency 1440 minutes", Some(1)),
            "ERR_RESTORE_FREQUENCY"
        );
        assert_eq!(
            map_restore_error("System Protection disabled", Some(1)),
            "ERR_RESTORE_PROTECTION_DISABLED"
        );
        assert_eq!(map_restore_error("", Some(5)), "ERR_RESTORE_FAILED:exit 5");
        assert_eq!(map_restore_error("", None), "ERR_RESTORE_FAILED:exit ?");
        let long = "x".repeat(500);
        assert_eq!(
            map_restore_error(&long, Some(2)),
            format!("ERR_RESTORE_FAILED:exit 2: {}", "x".repeat(300))
        );
    }
}
