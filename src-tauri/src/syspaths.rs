//! Windows well-known directories, exposed so the frontend can build default scan paths.

use serde::Serialize;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemPaths {
    pub program_files: Option<String>,
    pub program_files_x86: Option<String>,
    pub common_program_files: Option<String>,
    pub common_program_files_x86: Option<String>,
    pub program_data: Option<String>,
    pub local_app_data: Option<String>,
}

/// Uses forward slashes, drops trailing slashes; empty values become `None`.
fn normalize(v: Option<String>) -> Option<String> {
    let s = v?.replace('\\', "/");
    let s = s.trim_end_matches('/');
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

/// Builds the paths from an injected environment lookup.
fn from_env(get: impl Fn(&str) -> Option<String>) -> SystemPaths {
    SystemPaths {
        program_files: normalize(get("ProgramFiles")),
        program_files_x86: normalize(get("ProgramFiles(x86)")),
        common_program_files: normalize(get("CommonProgramFiles")),
        common_program_files_x86: normalize(get("CommonProgramFiles(x86)")),
        program_data: normalize(get("ProgramData")),
        local_app_data: normalize(get("LOCALAPPDATA")),
    }
}

/// Windows program directories; all `None` on other operating systems.
#[tauri::command]
pub fn system_paths() -> SystemPaths {
    if cfg!(windows) {
        from_env(|k| std::env::var(k).ok())
    } else {
        SystemPaths::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_injected_env() {
        let p = from_env(|k| match k {
            "ProgramFiles" => Some("C:\\Program Files\\".into()),
            "ProgramFiles(x86)" => Some("C:\\Program Files (x86)".into()),
            "ProgramData" => Some("".into()),
            "LOCALAPPDATA" => Some("C:/Users/me/AppData/Local/".into()),
            _ => None,
        });
        assert_eq!(p.program_files.as_deref(), Some("C:/Program Files"));
        assert_eq!(
            p.program_files_x86.as_deref(),
            Some("C:/Program Files (x86)")
        );
        assert_eq!(p.program_data, None);
        assert_eq!(p.common_program_files, None);
        assert_eq!(
            p.local_app_data.as_deref(),
            Some("C:/Users/me/AppData/Local")
        );
    }

    #[test]
    fn serializes_camel_case() {
        let v = serde_json::to_value(SystemPaths::default()).unwrap();
        for k in [
            "programFiles",
            "programFilesX86",
            "commonProgramFiles",
            "commonProgramFilesX86",
            "programData",
            "localAppData",
        ] {
            assert!(v.get(k).is_some(), "{k}");
        }
    }
}
