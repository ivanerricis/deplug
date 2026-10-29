//! Plugin uninstall backend: move plugins to the trash and create restore points.

use std::path::{Component, Path};

const PLUGIN_EXTENSIONS: [&str; 6] = ["dll", "vst", "vst3", "aaxplugin", "component", "so"];

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

#[tauri::command]
pub async fn trash_plugin(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(path);
    tauri::async_runtime::spawn_blocking(move || {
        validate_plugin_path(&p)?;
        trash::delete(&p).map_err(|e| format!("ERR_TRASH_FAILED:{e}"))
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

#[cfg(windows)]
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
