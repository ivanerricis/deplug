//! Portable-mode logic, independent of Tauri/GTK.

use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Marker file whose presence next to the app enables portable mode.
pub const MARKER: &str = "portable.txt";
/// Name of the data directory created next to the app in portable mode.
pub const DATA_DIR_NAME: &str = "PluginUninstaller-data";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TargetOs {
    Windows,
    MacOs,
    Linux,
}

impl TargetOs {
    pub fn current() -> TargetOs {
        if cfg!(target_os = "windows") {
            TargetOs::Windows
        } else if cfg!(target_os = "macos") {
            TargetOs::MacOs
        } else {
            TargetOs::Linux
        }
    }
}

fn exe_folder(exe: &Path) -> PathBuf {
    exe.parent().map(Path::to_path_buf).unwrap_or_default()
}

/// Folder that holds the app (and where the marker / data dir live).
pub fn base_dir(exe: &Path, appimage: Option<&OsStr>, os: TargetOs) -> PathBuf {
    match os {
        TargetOs::Windows => exe_folder(exe),
        TargetOs::Linux => match appimage {
            Some(p) if !p.is_empty() => Path::new(p)
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| exe_folder(exe)),
            _ => exe_folder(exe),
        },
        TargetOs::MacOs => exe
            .ancestors()
            .skip(1)
            .find(|a| {
                a.extension()
                    .map(|e| e.eq_ignore_ascii_case("app"))
                    .unwrap_or(false)
            })
            .and_then(Path::parent)
            .map(Path::to_path_buf)
            .unwrap_or_else(|| exe_folder(exe)),
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PortableResolution {
    Portable { data_dir: PathBuf },
    Installed { warning: Option<String> },
}

fn installed_warn(msg: String) -> PortableResolution {
    PortableResolution::Installed { warning: Some(msg) }
}

/// Decide whether to run in portable mode and prepare the data directory.
pub fn resolve(base: &Path, env_force: bool) -> PortableResolution {
    if !env_force && !base.join(MARKER).exists() {
        return PortableResolution::Installed { warning: None };
    }
    if base
        .to_string_lossy()
        .replace('\\', "/")
        .contains("/AppTranslocation/")
    {
        return installed_warn(
            "Modalità portatile non disponibile: l'app è eseguita da una posizione \
             temporanea di macOS (AppTranslocation). Sposta l'app (.app) in un'altra \
             cartella, oppure esegui `xattr -dr com.apple.quarantine <App.app>`, e riavviala."
                .to_string(),
        );
    }
    let data_dir = base.join(DATA_DIR_NAME);
    if let Err(e) = fs::create_dir_all(&data_dir) {
        return installed_warn(format!(
            "Modalità portatile non disponibile: impossibile creare la cartella dati {}: {}. \
             Uso la modalità installata.",
            data_dir.display(),
            e
        ));
    }
    let probe = data_dir.join(format!(".write-test-{}.tmp", std::process::id()));
    let probed = fs::write(&probe, b"ok").and_then(|_| fs::remove_file(&probe));
    if let Err(e) = probed {
        let _ = fs::remove_file(&probe);
        return installed_warn(format!(
            "Modalità portatile non disponibile: la cartella dati {} non è scrivibile: {}. \
             Uso la modalità installata.",
            data_dir.display(),
            e
        ));
    }
    PortableResolution::Portable { data_dir }
}

/// Environment variables to set so that the runtime stores its data in `data_dir`.
pub fn env_overrides(data_dir: &Path, os: TargetOs) -> Vec<(&'static str, PathBuf)> {
    match os {
        TargetOs::Windows => vec![("WEBVIEW2_USER_DATA_FOLDER", data_dir.join("webview"))],
        TargetOs::Linux => vec![
            ("XDG_CONFIG_HOME", data_dir.join("config")),
            ("XDG_DATA_HOME", data_dir.join("data")),
            ("XDG_CACHE_HOME", data_dir.join("cache")),
        ],
        TargetOs::MacOs => Vec::new(),
    }
}

fn default_version() -> u32 {
    1
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    pub custom_scan_paths: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            version: default_version(),
            custom_scan_paths: Vec::new(),
        }
    }
}

/// Load settings; missing or corrupt files yield defaults.
pub fn load(path: &Path) -> Settings {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// Save settings atomically (write `.tmp`, then rename).
pub fn save(path: &Path, settings: &Settings) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    let json = serde_json::to_vec_pretty(settings).map_err(io::Error::other)?;
    let mut tmp_name = path.as_os_str().to_owned();
    tmp_name.push(".tmp");
    let tmp = PathBuf::from(tmp_name);
    let res = fs::write(&tmp, json).and_then(|_| fs::rename(&tmp, path));
    if res.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn base_windows_is_exe_folder() {
        let exe = Path::new("C:/Apps/PU/pu.exe");
        assert_eq!(
            base_dir(exe, None, TargetOs::Windows),
            PathBuf::from("C:/Apps/PU")
        );
    }

    #[test]
    fn base_linux_appimage_and_fallback() {
        let exe = Path::new("/tmp/.mount_x/usr/bin/pu");
        let ai = OsStr::new("/home/u/Apps/PU.AppImage");
        assert_eq!(
            base_dir(exe, Some(ai), TargetOs::Linux),
            PathBuf::from("/home/u/Apps")
        );
        assert_eq!(
            base_dir(exe, None, TargetOs::Linux),
            PathBuf::from("/tmp/.mount_x/usr/bin")
        );
        assert_eq!(
            base_dir(exe, Some(OsStr::new("")), TargetOs::Linux),
            PathBuf::from("/tmp/.mount_x/usr/bin")
        );
    }

    #[test]
    fn base_macos_bundle_and_fallback() {
        let exe = Path::new("/Users/u/Tools/PU.app/Contents/MacOS/pu");
        assert_eq!(
            base_dir(exe, None, TargetOs::MacOs),
            PathBuf::from("/Users/u/Tools")
        );
        let plain = Path::new("/opt/tools/pu");
        assert_eq!(
            base_dir(plain, None, TargetOs::MacOs),
            PathBuf::from("/opt/tools")
        );
    }

    #[test]
    fn current_os_matches_cfg() {
        let c = TargetOs::current();
        if cfg!(target_os = "linux") {
            assert_eq!(c, TargetOs::Linux);
        }
    }

    #[test]
    fn no_marker_is_installed() {
        let d = tempdir().unwrap();
        assert_eq!(
            resolve(d.path(), false),
            PortableResolution::Installed { warning: None }
        );
        assert!(!d.path().join(DATA_DIR_NAME).exists());
    }

    #[test]
    fn marker_enables_portable() {
        let d = tempdir().unwrap();
        fs::write(d.path().join(MARKER), "").unwrap();
        let expected = d.path().join(DATA_DIR_NAME);
        assert_eq!(
            resolve(d.path(), false),
            PortableResolution::Portable {
                data_dir: expected.clone()
            }
        );
        assert!(expected.is_dir());
        // probe file cleaned up
        assert_eq!(fs::read_dir(&expected).unwrap().count(), 0);
    }

    #[test]
    fn env_force_enables_portable() {
        let d = tempdir().unwrap();
        assert!(matches!(
            resolve(d.path(), true),
            PortableResolution::Portable { .. }
        ));
    }

    #[test]
    fn unwritable_base_falls_back_with_warning() {
        let d = tempdir().unwrap();
        let file = d.path().join("regular-file");
        fs::write(&file, "x").unwrap();
        let base = file.join("sub");
        match resolve(&base, true) {
            PortableResolution::Installed { warning: Some(w) } => {
                assert!(w.contains("Modalità portatile"));
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn translocation_is_installed_with_warning() {
        let d = tempdir().unwrap();
        let base = d.path().join("AppTranslocation").join("ABC").join("d");
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join(MARKER), "").unwrap();
        match resolve(&base, false) {
            PortableResolution::Installed { warning: Some(w) } => {
                assert!(w.contains("AppTranslocation"));
                assert!(w.contains("xattr -dr com.apple.quarantine"));
            }
            other => panic!("unexpected {other:?}"),
        }
        assert!(!base.join(DATA_DIR_NAME).exists());
    }

    #[test]
    fn env_overrides_per_os() {
        let d = Path::new("/data");
        assert_eq!(
            env_overrides(d, TargetOs::Windows),
            vec![("WEBVIEW2_USER_DATA_FOLDER", d.join("webview"))]
        );
        assert_eq!(
            env_overrides(d, TargetOs::Linux),
            vec![
                ("XDG_CONFIG_HOME", d.join("config")),
                ("XDG_DATA_HOME", d.join("data")),
                ("XDG_CACHE_HOME", d.join("cache")),
            ]
        );
        assert!(env_overrides(d, TargetOs::MacOs).is_empty());
    }

    #[test]
    fn settings_defaults() {
        let s = Settings::default();
        assert_eq!(s.version, 1);
        assert!(s.custom_scan_paths.is_empty());
    }

    #[test]
    fn settings_roundtrip_no_tmp() {
        let d = tempdir().unwrap();
        let p = d.path().join("nested/dir/settings.json");
        let s = Settings {
            version: 2,
            custom_scan_paths: vec!["/a".into(), "/b".into()],
        };
        save(&p, &s).unwrap();
        assert_eq!(load(&p), s);
        let raw = fs::read_to_string(&p).unwrap();
        assert!(raw.contains("customScanPaths"));
        save(&p, &s).unwrap(); // overwrite
        let names: Vec<_> = fs::read_dir(p.parent().unwrap())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, vec![OsStr::new("settings.json")]);
    }

    #[test]
    fn settings_missing_and_corrupt_give_defaults() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        assert_eq!(load(&p), Settings::default());
        fs::write(&p, "{not json").unwrap();
        assert_eq!(load(&p), Settings::default());
    }

    #[test]
    fn settings_unknown_and_partial_fields() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"customScanPaths":["/x"],"future":{"a":1}}"#).unwrap();
        let s = load(&p);
        assert_eq!(s.version, 1);
        assert_eq!(s.custom_scan_paths, vec!["/x".to_string()]);
        fs::write(&p, "{}").unwrap();
        assert_eq!(load(&p), Settings::default());
    }

    #[test]
    fn save_failure_leaves_no_tmp() {
        let d = tempdir().unwrap();
        let p = d.path().join("target-dir");
        fs::create_dir(&p).unwrap(); // rename file over dir fails
        assert!(save(&p, &Settings::default()).is_err());
        assert!(!d.path().join("target-dir.tmp").exists());
    }
}
