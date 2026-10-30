//! Portable-mode logic, independent of Tauri/GTK.

use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Marker file whose presence next to the app enables portable mode.
pub const MARKER: &str = "portable.txt";
/// Name of the data directory created next to the app in portable mode.
pub const DATA_DIR_NAME: &str = "Deplug-data";

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

/// Warning code: portable data dir cannot be created or written.
pub const WARN_NOT_WRITABLE: &str = "WARN_NOT_WRITABLE";
/// Warning code: app runs from a macOS AppTranslocation location.
pub const WARN_APP_TRANSLOCATION: &str = "WARN_APP_TRANSLOCATION";

/// Fallback to installed mode with a stable warning code (localized by the frontend).
fn installed_warn(code: &str) -> PortableResolution {
    PortableResolution::Installed {
        warning: Some(code.to_string()),
    }
}

/// Decide whether to run in portable mode and prepare the data directory.
/// Fallback warnings are machine codes (`WARN_*`), not human-readable text.
pub fn resolve(base: &Path, env_force: bool) -> PortableResolution {
    if !env_force && !base.join(MARKER).exists() {
        return PortableResolution::Installed { warning: None };
    }
    if base
        .to_string_lossy()
        .replace('\\', "/")
        .contains("/AppTranslocation/")
    {
        return installed_warn(WARN_APP_TRANSLOCATION);
    }
    let data_dir = base.join(DATA_DIR_NAME);
    if fs::create_dir_all(&data_dir).is_err() {
        return installed_warn(WARN_NOT_WRITABLE);
    }
    let probe = data_dir.join(format!(".write-test-{}.tmp", std::process::id()));
    let probed = fs::write(&probe, b"ok").and_then(|_| fs::remove_file(&probe));
    if probed.is_err() {
        let _ = fs::remove_file(&probe);
        return installed_warn(WARN_NOT_WRITABLE);
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

fn default_system() -> String {
    "system".to_string()
}

fn default_delete_method() -> String {
    "trash".to_string()
}

fn default_stable() -> String {
    "stable".to_string()
}

fn default_true() -> bool {
    true
}

fn default_scan_depth() -> u8 {
    6
}

const MAX_SCAN_EXCLUSIONS: usize = 50;
const MAX_EXCLUSION_LEN: usize = 100;
const COLUMNS: [&str; 4] = ["path", "size", "modified", "arch"];
const TABS: [&str; 6] = ["all", "VST2", "VST3", "AAX", "AU", "CLAP"];
const SORT_KEYS: [&str; 4] = ["name", "path", "size", "modified"];

fn default_columns() -> Vec<String> {
    COLUMNS.iter().map(|c| c.to_string()).collect()
}

fn default_density() -> String {
    "comfortable".to_string()
}

fn default_tab() -> String {
    "all".to_string()
}

/// Sort column and direction of the plugin list.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct SortSetting {
    /// "name" | "path" | "size" | "modified"
    pub key: String,
    /// "asc" | "desc"
    pub dir: String,
}

impl Default for SortSetting {
    fn default() -> Self {
        SortSetting {
            key: "name".to_string(),
            dir: "asc".to_string(),
        }
    }
}

impl SortSetting {
    fn sanitized(mut self) -> Self {
        if !SORT_KEYS.contains(&self.key.as_str()) {
            self.key = "name".to_string();
        }
        if !matches!(self.dir.as_str(), "asc" | "desc") {
            self.dir = "asc".to_string();
        }
        self
    }
}

/// Trims, drops empty and duplicate (case-insensitive) entries and caps the count and length.
fn sanitize_exclusions(list: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for item in list {
        let t = item.trim();
        if t.is_empty() || t.chars().count() > MAX_EXCLUSION_LEN {
            continue;
        }
        if seen.insert(t.to_lowercase()) {
            out.push(t.to_string());
            if out.len() == MAX_SCAN_EXCLUSIONS {
                break;
            }
        }
    }
    out
}

/// Allowed range for `custom_scan_depth`.
const SCAN_DEPTH_RANGE: std::ops::RangeInclusive<u8> = 1..=10;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    pub custom_scan_paths: Vec<String>,
    /// "system" | "en" | "it"
    pub language: String,
    /// "system" | "light" | "dark"
    pub theme: String,
    pub restore_point_default: bool,
    pub scan_on_startup: bool,
    /// Max folder depth for custom scans, clamped to 1..=10.
    pub custom_scan_depth: u8,
    pub disabled_system_paths: Vec<String>,
    /// Windows only: relaunch Deplug elevated at startup (default on).
    pub run_as_admin: bool,
    /// Windows only: also search the registry for leftover keys when uninstalling (default off).
    pub search_registry_leftovers: bool,
    /// "trash" | "permanent": how uninstalled plugins are deleted.
    pub delete_method: String,
    /// Ask for confirmation before uninstalling (default on).
    pub confirm_uninstall: bool,
    /// Opt-in: look for a newer release shortly after startup (default off).
    pub check_updates_on_startup: bool,
    /// "stable" | "prerelease"
    pub update_channel: String,
    /// Unix time in milliseconds of the last automatic update check (0 = never).
    pub last_update_check: u64,
    /// Name patterns (`*` wildcard) of plugins and folders the scan skips.
    pub scan_exclusions: Vec<String>,
    /// Optional list columns shown: "path" | "size" | "modified" | "arch".
    pub visible_columns: Vec<String>,
    /// "comfortable" | "compact"
    pub density: String,
    /// "all" | "VST2" | "VST3" | "AAX" | "AU" | "CLAP"
    pub default_tab: String,
    pub default_sort: SortSetting,
    /// Restore the last used tab and sort at startup instead of the defaults.
    pub remember_view: bool,
    pub last_tab: String,
    pub last_sort: SortSetting,
    /// The first-run welcome screen was dismissed. A fresh install has no file and gets
    /// `false` from `Default`; a settings file written before this field existed counts as
    /// "seen" so upgrading users are not welcomed again.
    #[serde(default = "default_true")]
    pub welcome_seen: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            version: default_version(),
            custom_scan_paths: Vec::new(),
            language: default_system(),
            theme: default_system(),
            restore_point_default: default_true(),
            scan_on_startup: default_true(),
            custom_scan_depth: default_scan_depth(),
            disabled_system_paths: Vec::new(),
            run_as_admin: true,
            search_registry_leftovers: false,
            delete_method: default_delete_method(),
            confirm_uninstall: default_true(),
            check_updates_on_startup: false,
            update_channel: default_stable(),
            last_update_check: 0,
            scan_exclusions: Vec::new(),
            visible_columns: default_columns(),
            density: default_density(),
            default_tab: default_tab(),
            default_sort: SortSetting::default(),
            remember_view: true,
            last_tab: default_tab(),
            last_sort: SortSetting::default(),
            welcome_seen: false,
        }
    }
}

impl Settings {
    /// Normalizes out-of-range values: invalid enums become "system", depth is clamped.
    pub fn sanitized(mut self) -> Self {
        if !matches!(self.language.as_str(), "system" | "en" | "it") {
            self.language = default_system();
        }
        if !matches!(self.theme.as_str(), "system" | "light" | "dark") {
            self.theme = default_system();
        }
        if !matches!(self.delete_method.as_str(), "trash" | "permanent") {
            self.delete_method = default_delete_method();
        }
        if !matches!(self.update_channel.as_str(), "stable" | "prerelease") {
            self.update_channel = default_stable();
        }
        self.custom_scan_depth = self
            .custom_scan_depth
            .clamp(*SCAN_DEPTH_RANGE.start(), *SCAN_DEPTH_RANGE.end());
        self.scan_exclusions = sanitize_exclusions(std::mem::take(&mut self.scan_exclusions));
        // Canonical order, no unknown or repeated columns.
        let cols = std::mem::take(&mut self.visible_columns);
        self.visible_columns = COLUMNS
            .iter()
            .filter(|c| cols.iter().any(|v| v == *c))
            .map(|c| c.to_string())
            .collect();
        if !matches!(self.density.as_str(), "comfortable" | "compact") {
            self.density = default_density();
        }
        if !TABS.contains(&self.default_tab.as_str()) {
            self.default_tab = default_tab();
        }
        if !TABS.contains(&self.last_tab.as_str()) {
            self.last_tab = default_tab();
        }
        self.default_sort = std::mem::take(&mut self.default_sort).sanitized();
        self.last_sort = std::mem::take(&mut self.last_sort).sanitized();
        self
    }
}

/// Load settings (sanitized); missing or corrupt files yield defaults.
pub fn load(path: &Path) -> Settings {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice::<Settings>(&b).ok())
        .unwrap_or_default()
        .sanitized()
}

/// Save sanitized settings atomically (write `.tmp`, then rename).
pub fn save(path: &Path, settings: &Settings) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    let json =
        serde_json::to_vec_pretty(&settings.clone().sanitized()).map_err(io::Error::other)?;
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
                assert_eq!(w, WARN_NOT_WRITABLE);
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
                assert_eq!(w, WARN_APP_TRANSLOCATION);
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
        assert_eq!(s.language, "system");
        assert_eq!(s.theme, "system");
        assert!(s.restore_point_default);
        assert!(s.scan_on_startup);
        assert_eq!(s.custom_scan_depth, 6);
        assert!(s.disabled_system_paths.is_empty());
        assert!(s.run_as_admin);
        assert!(!s.search_registry_leftovers);
        assert_eq!(s.delete_method, "trash");
        assert!(s.confirm_uninstall);
        assert!(s.scan_exclusions.is_empty());
        assert_eq!(s.visible_columns, ["path", "size", "modified", "arch"]);
        assert_eq!(s.density, "comfortable");
        assert_eq!(s.default_tab, "all");
        assert_eq!(s.default_sort, SortSetting::default());
        assert!(s.remember_view);
    }

    #[test]
    fn settings_view_and_exclusions_sanitized() {
        let long = "x".repeat(101);
        let many: Vec<String> = (0..60).map(|i| format!("p{i}")).collect();
        let s = Settings {
            scan_exclusions: [vec!["  Demo ".into(), "demo".into(), "".into(), long], many]
                .concat(),
            visible_columns: vec!["size".into(), "bogus".into(), "path".into(), "size".into()],
            density: "huge".into(),
            default_tab: "VST9".into(),
            last_tab: "CLAP".into(),
            default_sort: SortSetting {
                key: "color".into(),
                dir: "up".into(),
            },
            last_sort: SortSetting {
                key: "size".into(),
                dir: "desc".into(),
            },
            ..Settings::default()
        }
        .sanitized();
        assert_eq!(s.scan_exclusions.len(), 50);
        assert_eq!(s.scan_exclusions[0], "Demo");
        assert_eq!(s.scan_exclusions[1], "p0");
        assert_eq!(s.visible_columns, ["path", "size"]);
        assert_eq!(s.density, "comfortable");
        assert_eq!(s.default_tab, "all");
        assert_eq!(s.last_tab, "CLAP");
        assert_eq!(s.default_sort, SortSetting::default());
        assert_eq!(s.last_sort.key, "size");
    }

    #[test]
    fn settings_old_file_gets_view_defaults() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(
            &p,
            r#"{"version":1,"visibleColumns":[],"defaultSort":{"key":"size"}}"#,
        )
        .unwrap();
        let s = load(&p);
        assert!(s.visible_columns.is_empty());
        assert_eq!(s.default_sort.key, "size");
        assert_eq!(s.default_sort.dir, "asc");
        assert!(s.remember_view);
        fs::write(&p, r#"{"version":1}"#).unwrap();
        // An existing file without the field counts as welcomed.
        assert_eq!(
            load(&p),
            Settings {
                welcome_seen: true,
                ..Settings::default()
            }
        );
    }

    #[test]
    fn settings_depth_clamped_on_load_and_save() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"customScanDepth":0}"#).unwrap();
        assert_eq!(load(&p).custom_scan_depth, 1);
        fs::write(&p, r#"{"customScanDepth":200}"#).unwrap();
        assert_eq!(load(&p).custom_scan_depth, 10);
        let s = Settings {
            custom_scan_depth: 99,
            ..Settings::default()
        };
        save(&p, &s).unwrap();
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
        assert_eq!(raw["customScanDepth"], 10);
    }

    #[test]
    fn settings_invalid_enums_fall_back() {
        let s = Settings {
            language: "fr".into(),
            theme: "blue".into(),
            ..Settings::default()
        }
        .sanitized();
        assert_eq!(s.language, "system");
        assert_eq!(s.theme, "system");
        let ok = Settings {
            language: "it".into(),
            theme: "dark".into(),
            ..Settings::default()
        }
        .sanitized();
        assert_eq!((ok.language.as_str(), ok.theme.as_str()), ("it", "dark"));
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"language":"xx","theme":""}"#).unwrap();
        let l = load(&p);
        assert_eq!(
            (l.language.as_str(), l.theme.as_str()),
            ("system", "system")
        );
    }

    #[test]
    fn settings_invalid_delete_method_falls_back_to_trash() {
        let s = Settings {
            delete_method: "shred".into(),
            ..Settings::default()
        }
        .sanitized();
        assert_eq!(s.delete_method, "trash");
    }

    #[test]
    fn settings_old_file_with_only_paths_loads() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"version":1,"customScanPaths":["/x"]}"#).unwrap();
        let s = load(&p);
        assert_eq!(s.custom_scan_paths, vec!["/x".to_string()]);
        assert_eq!(
            s,
            Settings {
                custom_scan_paths: vec!["/x".into()],
                welcome_seen: true,
                ..Settings::default()
            }
        );
    }

    #[test]
    fn settings_uninstall_flow_fields_default_for_old_files() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"version":1,"runAsAdmin":false}"#).unwrap();
        let s = load(&p);
        assert_eq!(s.delete_method, "trash");
        assert!(s.confirm_uninstall);
        fs::write(
            &p,
            r#"{"deleteMethod":"permanent","confirmUninstall":false}"#,
        )
        .unwrap();
        let s = load(&p);
        assert_eq!(s.delete_method, "permanent");
        assert!(!s.confirm_uninstall);
    }

    #[test]
    fn settings_run_as_admin_serializes_camel_case_and_old_files_default_on() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"runAsAdmin":false}"#).unwrap();
        assert!(!load(&p).run_as_admin);
        fs::write(&p, r#"{"version":1,"scanOnStartup":false}"#).unwrap();
        assert!(load(&p).run_as_admin);
        let s = Settings {
            run_as_admin: false,
            ..Settings::default()
        };
        save(&p, &s).unwrap();
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
        assert_eq!(raw["runAsAdmin"], false);
    }

    #[test]
    fn settings_search_registry_leftovers_defaults_off_and_serializes_camel_case() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"version":1,"runAsAdmin":false}"#).unwrap();
        assert!(!load(&p).search_registry_leftovers);
        fs::write(&p, r#"{"searchRegistryLeftovers":true}"#).unwrap();
        assert!(load(&p).search_registry_leftovers);
        let s = Settings {
            search_registry_leftovers: true,
            ..Settings::default()
        };
        save(&p, &s).unwrap();
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
        assert_eq!(raw["searchRegistryLeftovers"], true);
    }

    #[test]
    fn settings_update_fields_default_off_and_sanitize() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        fs::write(&p, r#"{"version":1,"scanOnStartup":false}"#).unwrap();
        let s = load(&p);
        assert!(!s.check_updates_on_startup);
        assert_eq!(s.update_channel, "stable");
        assert_eq!(s.last_update_check, 0);
        fs::write(
            &p,
            r#"{"checkUpdatesOnStartup":true,"updateChannel":"nightly","lastUpdateCheck":42}"#,
        )
        .unwrap();
        let s = load(&p);
        assert!(s.check_updates_on_startup);
        assert_eq!(s.update_channel, "stable");
        assert_eq!(s.last_update_check, 42);
        fs::write(&p, r#"{"updateChannel":"prerelease"}"#).unwrap();
        assert_eq!(load(&p).update_channel, "prerelease");
    }

    #[test]
    fn settings_welcome_seen_is_false_for_new_installs_and_true_for_old_files() {
        let d = tempdir().unwrap();
        let p = d.path().join("s.json");
        assert!(!Settings::default().welcome_seen);
        assert!(!load(&p).welcome_seen); // no file yet
        fs::write(&p, r#"{"version":1,"scanOnStartup":false}"#).unwrap();
        assert!(load(&p).welcome_seen);
        fs::write(&p, r#"{"welcomeSeen":false}"#).unwrap();
        assert!(!load(&p).welcome_seen);
        let s = Settings {
            welcome_seen: true,
            ..Settings::default()
        };
        save(&p, &s).unwrap();
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
        assert_eq!(raw["welcomeSeen"], true);
    }

    #[test]
    fn settings_roundtrip_no_tmp() {
        let d = tempdir().unwrap();
        let p = d.path().join("nested/dir/settings.json");
        let s = Settings {
            version: 2,
            custom_scan_paths: vec!["/a".into(), "/b".into()],
            language: "it".into(),
            theme: "dark".into(),
            restore_point_default: false,
            scan_on_startup: false,
            custom_scan_depth: 3,
            disabled_system_paths: vec!["/sys".into()],
            run_as_admin: true,
            search_registry_leftovers: true,
            delete_method: "permanent".into(),
            confirm_uninstall: false,
            check_updates_on_startup: true,
            update_channel: "prerelease".into(),
            last_update_check: 1_700_000_000_000,
            scan_exclusions: vec!["*Demo*".into()],
            ..Settings::default()
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
        // An existing file without the field counts as welcomed.
        assert_eq!(
            load(&p),
            Settings {
                welcome_seen: true,
                ..Settings::default()
            }
        );
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
