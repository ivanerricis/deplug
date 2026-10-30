//! Registry leftovers of a single plugin (Windows only): discovery and deletion of registry KEYS.
//!
//! Security model: nothing but the plugin file path and the key names the backend itself reported
//! ever comes from the frontend. The candidate set is re-derived on every call, a key must be in
//! it and pass a strict structural check (hive, depth, denylist), and every key is exported to a
//! `.reg` backup before anything is deleted: if the export fails, nothing is deleted. Only keys
//! under `HKCU\Software` and `HKLM\SOFTWARE` (+ `WOW6432Node`) at depth 1-2 whose name EXACTLY
//! equals the publisher or "Publisher Product" are ever candidates, plus the product's own
//! `Uninstall` entry when its uninstaller is gone. Values are never touched on their own.
#![cfg_attr(not(windows), allow(dead_code))]

use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::leftovers::is_protected_name;
use crate::settings::SettingsPath;
#[cfg(windows)]
use crate::uninstall::check_script_safe;
use crate::uninstall::ps_quote;
use crate::vendor::{
    command_program, is_generic_name, normalize_name, select_entries, strip_arch_suffix,
    UninstallEntry,
};

/// Keys with more subkeys (whole subtree) or values than this are never offered.
const MAX_SUBKEYS: u32 = 500;
const MAX_VALUES: u32 = 500;
const MAX_RESULTS: usize = 20;
/// Keys accepted by one delete call (also bounds the elevated script).
const MAX_KEYS_PER_CALL: usize = 50;
/// Registry nesting walked when measuring a key.
const MAX_WALK_DEPTH: usize = 8;
const UNINSTALL_TAIL: &str = r"Microsoft\Windows\CurrentVersion\Uninstall";
/// Folder (inside the settings folder) that receives the `.reg` backups.
const BACKUP_DIR: &str = "registry-backups";

/// First-level names (below `Software`) that are never touched, whatever the publisher is called.
/// Besides these, the folder deny-list of `leftovers.rs` applies.
const DENIED_ROOT_NAMES: [&str; 14] = [
    "microsoft",
    "windows",
    "classes",
    "policies",
    "wow6432node",
    "clients",
    "registeredapplications",
    "steinberg",
    "odbc",
    "javasoft",
    "khronos",
    "avid",
    "vstplugins",
    "vst3",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryLeftover {
    /// Full key, for example `HKCU\Software\Acme`.
    pub key: String,
    /// Subkeys in the whole subtree.
    pub subkeys: u32,
    /// Values in the whole subtree.
    pub values: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryDeleteResult {
    pub deleted: usize,
    /// One `ERR_...(<detail>):<key>` entry per key that failed.
    pub failures: Vec<String>,
    /// Folder holding the `.reg` backups; None when nothing was exported.
    pub backup_dir: Option<String>,
}

// ---------------------------------------------------------------------------------------------
// Key paths
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Hive {
    Hkcu,
    Hklm,
}

impl Hive {
    fn name(self) -> &'static str {
        match self {
            Hive::Hkcu => "HKCU",
            Hive::Hklm => "HKLM",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyPath {
    pub hive: Hive,
    /// Path below the hive, `\`-separated, never empty.
    pub path: String,
}

impl KeyPath {
    pub fn parse(s: &str) -> Option<KeyPath> {
        if s.chars().any(char::is_control) {
            return None;
        }
        let (hive, rest) = s.split_once('\\')?;
        let hive = match hive.to_ascii_uppercase().as_str() {
            "HKCU" | "HKEY_CURRENT_USER" => Hive::Hkcu,
            "HKLM" | "HKEY_LOCAL_MACHINE" => Hive::Hklm,
            _ => return None,
        };
        if rest.split('\\').any(str::is_empty) {
            return None;
        }
        Some(KeyPath {
            hive,
            path: rest.to_string(),
        })
    }

    pub fn display(&self) -> String {
        format!("{}\\{}", self.hive.name(), self.path)
    }

    fn join(&self, child: &str) -> KeyPath {
        KeyPath {
            hive: self.hive,
            path: format!("{}\\{child}", self.path),
        }
    }

    /// Case-insensitive identity (the registry ignores case in key names).
    fn identity(&self) -> String {
        self.display().to_lowercase()
    }

    fn depth(&self) -> usize {
        self.path.split('\\').count()
    }
}

/// The three places in which software keys are searched.
fn software_roots() -> [KeyPath; 3] {
    [
        KeyPath {
            hive: Hive::Hkcu,
            path: "Software".into(),
        },
        KeyPath {
            hive: Hive::Hklm,
            path: "SOFTWARE".into(),
        },
        KeyPath {
            hive: Hive::Hklm,
            path: r"SOFTWARE\WOW6432Node".into(),
        },
    ]
}

fn is_denied_root_name(seg: &str) -> bool {
    let n = normalize_name(seg);
    DENIED_ROOT_NAMES.contains(&n.as_str()) || is_protected_name(&n)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum KeyKind {
    Software,
    Uninstall,
}

/// Structural check shared by discovery and deletion: the key is `<root>\X` or `<root>\X\Y` with a
/// non-denied `X`, or exactly one entry below an `Uninstall` root. Everything else is refused.
fn classify(key: &KeyPath) -> Option<KeyKind> {
    let path = key.path.to_lowercase();
    // Longest root first: WOW6432Node is below SOFTWARE.
    let mut roots = software_roots();
    roots.sort_by_key(|r| std::cmp::Reverse(r.path.len()));
    for root in roots.iter().filter(|r| r.hive == key.hive) {
        let Some(rest) = path
            .strip_prefix(&root.path.to_lowercase())
            .and_then(|r| r.strip_prefix('\\'))
        else {
            continue;
        };
        if let Some(name) = rest
            .strip_prefix(&UNINSTALL_TAIL.to_lowercase())
            .and_then(|r| r.strip_prefix('\\'))
        {
            return (!name.contains('\\')).then_some(KeyKind::Uninstall);
        }
        let segs: Vec<&str> = rest.split('\\').collect();
        if segs.len() > 2 || segs.iter().any(|s| s.is_empty()) || is_denied_root_name(segs[0]) {
            return None;
        }
        return Some(KeyKind::Software);
    }
    None
}

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

/// Normalized names a key may carry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistryNames {
    pub publisher: String,
    pub products: Vec<String>,
    /// "<publisher> <product>" for every product.
    pub full: Vec<String>,
}

fn usable_name(n: &str) -> bool {
    n.chars().count() >= 3 && !is_generic_name(n) && !is_protected_name(n)
}

/// Names for the plugin. Without a usable publisher nothing can be matched: product names alone
/// are too ambiguous in the registry.
pub fn registry_names(
    plugin: &Path,
    publisher: Option<&str>,
    display_name: Option<&str>,
) -> Option<RegistryNames> {
    let publisher = normalize_name(publisher?);
    if !usable_name(&publisher) || is_denied_root_name(&publisher) {
        return None;
    }
    let strip = |n: &str| {
        n.strip_prefix(&publisher)
            .and_then(|r| r.strip_prefix(' '))
            .map(str::to_string)
    };
    let mut products: Vec<String> = Vec::new();
    if let Some(stem) = plugin.file_stem().and_then(|s| s.to_str()) {
        for n in [strip_arch_suffix(stem), normalize_name(stem)] {
            products.extend(strip(&n));
            products.push(n);
        }
    }
    let mut full: Vec<String> = Vec::new();
    if let Some(d) = display_name.map(normalize_name) {
        products.extend(strip(&d));
        if strip(&d).is_some() {
            full.push(d);
        }
    }
    products.retain(|p| usable_name(p) && *p != publisher);
    full.extend(products.iter().map(|p| format!("{publisher} {p}")));
    let mut seen = std::collections::HashSet::new();
    products.retain(|p| seen.insert(p.clone()));
    let mut seen = std::collections::HashSet::new();
    full.retain(|f| seen.insert(f.clone()));
    Some(RegistryNames {
        publisher,
        products,
        full,
    })
}

/// True when the key (`segs` below a software root, depth 1 or 2) is tied to the plugin by name.
fn software_key_matches(segs: &[&str], names: &RegistryNames) -> bool {
    let norm: Vec<String> = segs.iter().map(|s| normalize_name(s)).collect();
    match norm.as_slice() {
        [a] => !is_denied_root_name(a) && (*a == names.publisher || names.full.contains(a)),
        [a, b] => {
            *a == names.publisher
                && !is_denied_root_name(a)
                && (names.products.contains(b) || names.full.contains(b))
        }
        _ => false,
    }
}

// ---------------------------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------------------------

/// Registry access, abstracted so that discovery is testable without a registry.
pub trait RegistryIo {
    /// Names of the direct subkeys of `key`; empty when it does not exist.
    fn subkeys(&self, key: &KeyPath) -> Vec<String>;
    /// `(subkeys, values)` of the whole subtree; None when it is unreadable or too deep.
    fn stats(&self, key: &KeyPath) -> Option<(u32, u32)>;
}

pub fn within_limits(subkeys: u32, values: u32) -> bool {
    subkeys <= MAX_SUBKEYS && values <= MAX_VALUES
}

fn software_candidates(names: &RegistryNames, io: &dyn RegistryIo) -> Vec<KeyPath> {
    let mut out: Vec<KeyPath> = Vec::new();
    let push = |k: KeyPath, out: &mut Vec<KeyPath>| {
        if classify(&k) == Some(KeyKind::Software)
            && !out.iter().any(|o| o.identity() == k.identity())
        {
            out.push(k);
        }
    };
    for root in software_roots() {
        for name in io.subkeys(&root) {
            let first = root.join(&name);
            if software_key_matches(&[&name], names) {
                push(first.clone(), &mut out);
            }
            // Product keys are only looked for below the publisher's own key.
            if normalize_name(&name) == names.publisher {
                for sub in io.subkeys(&first) {
                    if software_key_matches(&[&name, &sub], names) {
                        push(first.join(&sub), &mut out);
                    }
                }
            }
        }
    }
    out
}

/// An `Uninstall` entry whose uninstaller program is gone (so it only clutters "Apps"). Entries
/// that use msiexec or whose program cannot be told are never orphaned.
pub fn is_orphaned(e: &UninstallEntry, exists: &dyn Fn(&str) -> bool) -> bool {
    let gone = |cmd: &Option<String>| match cmd.as_deref() {
        None => true,
        Some(c) => command_program(c).is_some_and(|p| !exists(&p)),
    };
    let main = e.uninstall_string.as_deref().and_then(command_program);
    main.is_some_and(|p| !exists(&p)) && gone(&e.quiet_uninstall_string)
}

/// Uninstall keys of the entries that belong to the plugin and are orphaned.
pub fn orphaned_uninstall_keys(
    keyed: &[(String, UninstallEntry)],
    plugin_path: &str,
    exists: &dyn Fn(&str) -> bool,
) -> Vec<KeyPath> {
    let entries: Vec<UninstallEntry> = keyed.iter().map(|(_, e)| e.clone()).collect();
    select_entries(&entries, plugin_path)
        .into_iter()
        .filter(|e| is_orphaned(e, exists))
        .filter_map(|e| {
            let i = entries.iter().position(|o| std::ptr::eq(o, e))?;
            KeyPath::parse(&keyed[i].0)
        })
        .filter(|k| classify(k) == Some(KeyKind::Uninstall))
        .collect()
}

/// Everything the backend would report for the plugin. `publisher` is the vendor from the bundle
/// metadata, if any; the registry's own publisher is the fallback.
pub fn derive_candidates(
    plugin: &Path,
    publisher: Option<String>,
    keyed: &[(String, UninstallEntry)],
    exists: &dyn Fn(&str) -> bool,
    io: &dyn RegistryIo,
) -> Vec<RegistryLeftover> {
    let plugin_str = plugin.to_string_lossy();
    let entries: Vec<UninstallEntry> = keyed.iter().map(|(_, e)| e.clone()).collect();
    let owner = select_entries(&entries, &plugin_str).into_iter().next();
    let publisher = publisher.or_else(|| owner.and_then(|e| e.publisher.clone()));
    let mut keys: Vec<KeyPath> = Vec::new();
    if let Some(names) = registry_names(
        plugin,
        publisher.as_deref(),
        owner.map(|e| e.display_name.as_str()),
    ) {
        keys = software_candidates(&names, io);
    }
    keys.extend(orphaned_uninstall_keys(keyed, &plugin_str, exists));
    keys.into_iter()
        .filter_map(|k| {
            let (subkeys, values) = io.stats(&k)?;
            within_limits(subkeys, values).then(|| RegistryLeftover {
                key: k.display(),
                subkeys,
                values,
            })
        })
        .take(MAX_RESULTS)
        .collect()
}

// ---------------------------------------------------------------------------------------------
// Deletion planning, backup and script building (pure)
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Default, PartialEq, Eq)]
pub struct DeletePlan {
    /// Keys to export and delete, deepest first.
    pub valid: Vec<KeyPath>,
    /// `ERR_REGISTRY_INVALID:<key>` for every requested key that is not a reported candidate.
    pub invalid: Vec<String>,
}

/// Keeps only requested keys that the backend itself reported and that pass the structural check.
pub fn plan_delete(requested: &[String], found: &[RegistryLeftover]) -> DeletePlan {
    let mut plan = DeletePlan::default();
    for raw in requested {
        let key = KeyPath::parse(raw).filter(|k| classify(k).is_some());
        let reported = key
            .as_ref()
            .is_some_and(|k| found.iter().any(|f| f.key.to_lowercase() == k.identity()));
        match key {
            Some(k) if reported => {
                if !plan.valid.iter().any(|v| v.identity() == k.identity()) {
                    plan.valid.push(k);
                }
            }
            _ => plan.invalid.push(format!("ERR_REGISTRY_INVALID:{raw}")),
        }
    }
    plan.valid.sort_by_key(|k| std::cmp::Reverse(k.depth()));
    plan
}

/// Name of the per-run backup folder: `<unix seconds>-<plugin name>` with safe characters only.
pub fn backup_folder_name(unix_secs: u64, plugin: &Path) -> String {
    let stem = plugin
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("plugin");
    format!("{unix_secs}-{}", sanitize_file_part(stem, 40))
}

/// File name of the backup of the `index`-th key.
pub fn backup_file_name(index: usize, key: &KeyPath) -> String {
    format!(
        "{:02}-{}.reg",
        index + 1,
        sanitize_file_part(&key.display(), 100)
    )
}

fn sanitize_file_part(s: &str, max: usize) -> String {
    let cleaned: String = s
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .take(max)
        .collect();
    if cleaned.is_empty() {
        "key".into()
    } else {
        cleaned
    }
}

/// Arguments for `reg.exe` (run without a shell): `export <key> <file> /y`.
pub fn reg_export_args(key: &KeyPath, file: &str) -> Vec<String> {
    vec![
        "export".into(),
        key.display(),
        file.to_string(),
        "/y".into(),
    ]
}

/// PowerShell provider path of a key: `HKLM\SOFTWARE\X` becomes `HKLM:\SOFTWARE\X`.
pub fn ps_registry_path(key: &KeyPath) -> String {
    format!("{}:\\{}", key.hive.name(), key.path)
}

/// Script that deletes each key recursively. Each result is appended to `log_path` as `OK|<index>`
/// or `ERR|<index>|<message>`; key names never reach the log. Keys are embedded as literals.
pub fn build_registry_delete_script(keys: &[KeyPath], log_path: &str) -> String {
    let list = keys
        .iter()
        .map(|k| ps_quote(&ps_registry_path(k)))
        .collect::<Vec<_>>()
        .join(",");
    let log = ps_quote(log_path);
    format!(
        "$ErrorActionPreference='Stop'; \
$log={log}; $keys=@({list}); \
for($i=0; $i -lt $keys.Count; $i++) {{ $k=$keys[$i]; \
try {{ \
if(Test-Path -LiteralPath $k) {{ Remove-Item -LiteralPath $k -Recurse -Force }}; \
Add-Content -LiteralPath $log -Value \"OK|$i\" -Encoding UTF8 \
}} catch {{ \
$m=($_.Exception.Message -replace '[\\r\\n|]+',' '); \
Add-Content -LiteralPath $log -Value \"ERR|$i|$m\" -Encoding UTF8 \
}} }}; exit 0"
    )
}

/// Failure entries of an elevated run, reusing the trash-log format (`ERR_TRASH_FAILED(<m>):<path>`
/// becomes `ERR_REGISTRY_DELETE_FAILED(<m>):<key>`).
pub fn parse_registry_log(log: &str, keys: &[KeyPath]) -> Vec<String> {
    let names: Vec<String> = keys.iter().map(KeyPath::display).collect();
    crate::uninstall::parse_trash_log(log, &names)
        .into_iter()
        .map(|f| f.replacen("ERR_TRASH_FAILED", "ERR_REGISTRY_DELETE_FAILED", 1))
        .collect()
}

/// `ERR_REGISTRY_DELETE_FAILED(<detail>):<key>` with the detail made safe for the entry format.
pub fn delete_failure(detail: &str, key: &KeyPath) -> String {
    let d: String = detail
        .replace(['(', ')'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(200)
        .collect();
    format!("ERR_REGISTRY_DELETE_FAILED({d}):{}", key.display())
}

// ---------------------------------------------------------------------------------------------
// Windows implementation
// ---------------------------------------------------------------------------------------------

#[cfg(windows)]
mod win {
    use super::*;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    fn root(hive: Hive) -> RegKey {
        RegKey::predef(match hive {
            Hive::Hkcu => HKEY_CURRENT_USER,
            Hive::Hklm => HKEY_LOCAL_MACHINE,
        })
    }

    fn open(key: &KeyPath) -> Option<RegKey> {
        root(key.hive)
            .open_subkey_with_flags(&key.path, KEY_READ)
            .ok()
    }

    /// Adds the subtree of `key` to the totals; false when a limit or the depth is exceeded.
    fn walk(key: &RegKey, depth: usize, subkeys: &mut u32, values: &mut u32) -> bool {
        let Ok(info) = key.query_info() else {
            return false;
        };
        *subkeys = subkeys.saturating_add(info.sub_keys);
        *values = values.saturating_add(info.values);
        if !within_limits(*subkeys, *values) || depth > MAX_WALK_DEPTH {
            return false;
        }
        if info.sub_keys == 0 {
            return true;
        }
        key.enum_keys().flatten().all(|name| {
            key.open_subkey_with_flags(&name, KEY_READ)
                .is_ok_and(|child| walk(&child, depth + 1, subkeys, values))
        })
    }

    pub struct WinIo;

    impl RegistryIo for WinIo {
        fn subkeys(&self, key: &KeyPath) -> Vec<String> {
            open(key)
                .map(|k| k.enum_keys().flatten().collect())
                .unwrap_or_default()
        }

        fn stats(&self, key: &KeyPath) -> Option<(u32, u32)> {
            let k = open(key)?;
            let (mut subkeys, mut values) = (0, 0);
            walk(&k, 0, &mut subkeys, &mut values).then_some((subkeys, values))
        }
    }

    pub fn delete_direct(key: &KeyPath) -> Result<(), String> {
        match root(key.hive).delete_subkey_all(&key.path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Exports `key` to `file` with the system `reg.exe` (no shell) and checks the result.
    pub fn export(key: &KeyPath, file: &Path) -> Result<(), String> {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let sys = std::env::var_os("SystemRoot").ok_or("SystemRoot is not set")?;
        let reg = Path::new(&sys).join("System32").join("reg.exe");
        let out = Command::new(reg)
            .args(reg_export_args(key, &file.to_string_lossy()))
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        let size = std::fs::metadata(file).map(|m| m.len()).unwrap_or(0);
        if size == 0 {
            return Err("empty backup file".into());
        }
        Ok(())
    }

    pub fn derive(plugin: &Path) -> Vec<RegistryLeftover> {
        let keyed = crate::vendor::registry::read_keyed_entries();
        let publisher = crate::leftovers::vendor_from_moduleinfo(plugin);
        derive_candidates(
            plugin,
            publisher,
            &keyed,
            &|p| Path::new(p).exists(),
            &WinIo,
        )
    }

    pub fn delete(
        plugin: &Path,
        keys: &[String],
        backup_root: &Path,
    ) -> Result<RegistryDeleteResult, String> {
        let plan = plan_delete(keys, &derive(plugin));
        let mut result = RegistryDeleteResult {
            failures: plan.invalid,
            ..Default::default()
        };
        if plan.valid.is_empty() {
            return Ok(result);
        }

        // Backup first: any failure aborts before a single key is deleted.
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_secs());
        let dir = backup_root.join(backup_folder_name(secs, plugin));
        std::fs::create_dir_all(&dir).map_err(|e| format!("ERR_REGISTRY_BACKUP_FAILED:{e}"))?;
        for (i, key) in plan.valid.iter().enumerate() {
            export(key, &dir.join(backup_file_name(i, key)))
                .map_err(|e| format!("ERR_REGISTRY_BACKUP_FAILED:{}: {e}", key.display()))?;
        }
        result.backup_dir = Some(dir.to_string_lossy().to_string());

        let elevated = crate::elevation::is_elevated();
        let (direct, via_script): (Vec<&KeyPath>, Vec<&KeyPath>) = plan
            .valid
            .iter()
            .partition(|k| k.hive == Hive::Hkcu || elevated);
        for key in direct {
            match delete_direct(key) {
                Ok(()) => result.deleted += 1,
                Err(e) => result.failures.push(delete_failure(&e, key)),
            }
        }
        if !via_script.is_empty() {
            let owned: Vec<KeyPath> = via_script.into_iter().cloned().collect();
            match crate::uninstall::run_elevated_logged(|log| {
                build_registry_delete_script(&owned, log)
            }) {
                Ok(log) => {
                    let failed = parse_registry_log(&log, &owned);
                    result.deleted += owned.len() - failed.len();
                    result.failures.extend(failed);
                }
                Err(code) => result
                    .failures
                    .extend(owned.iter().map(|k| format!("{code}:{}", k.display()))),
            }
        }
        Ok(result)
    }
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

/// The "Search the registry for leftovers" setting; read on every call so a stale frontend cannot
/// bypass it.
fn search_enabled(settings: &SettingsPath) -> bool {
    portable_core::load(&settings.0).search_registry_leftovers
}

/// Registry keys that look like leftovers of the plugin. The plugin must still exist. Empty off
/// Windows and when the setting is off.
#[tauri::command]
pub async fn find_registry_leftovers(
    plugin_path: String,
    settings: State<'_, SettingsPath>,
) -> Result<Vec<RegistryLeftover>, String> {
    #[cfg(windows)]
    {
        if !search_enabled(&settings) {
            return Ok(Vec::new());
        }
        tauri::async_runtime::spawn_blocking(move || {
            let p = std::path::PathBuf::from(plugin_path);
            crate::uninstall::validate_plugin_path(&p)?;
            Ok(win::derive(&p))
        })
        .await
        .map_err(|e| format!("ERR_INTERNAL:{e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (plugin_path, settings);
        Ok(Vec::new())
    }
}

/// Exports the given keys to `.reg` backups and deletes them. Only keys that
/// `find_registry_leftovers(plugin_path)` would report are accepted. Must be called while the
/// plugin still exists.
#[tauri::command]
pub async fn delete_registry_leftovers(
    plugin_path: String,
    keys: Vec<String>,
    settings: State<'_, SettingsPath>,
) -> Result<RegistryDeleteResult, String> {
    #[cfg(windows)]
    {
        if !search_enabled(&settings) {
            return Err("ERR_REGISTRY_DISABLED".into());
        }
        if keys.len() > MAX_KEYS_PER_CALL {
            return Err("ERR_INVALID_PATH".into());
        }
        check_script_safe(&keys)?;
        let backup_root = settings
            .0
            .parent()
            .ok_or("ERR_INTERNAL:no settings folder")?
            .join(BACKUP_DIR);
        tauri::async_runtime::spawn_blocking(move || {
            let p = std::path::PathBuf::from(plugin_path);
            crate::uninstall::validate_plugin_path(&p)?;
            win::delete(&p, &keys, &backup_root)
        })
        .await
        .map_err(|e| format!("ERR_INTERNAL:{e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (plugin_path, keys, settings);
        Err("ERR_REGISTRY_UNSUPPORTED".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// In-memory registry: key identity -> (subkey names, values).
    struct Fake {
        keys: HashMap<String, (Vec<String>, u32)>,
    }

    impl Fake {
        fn new(paths: &[&str]) -> Fake {
            let mut keys: HashMap<String, (Vec<String>, u32)> = HashMap::new();
            for p in paths {
                let parts: Vec<&str> = p.split('\\').collect();
                for i in 1..=parts.len() {
                    let id = parts[..i].join("\\").to_lowercase();
                    keys.entry(id).or_default();
                    if i > 1 {
                        let parent = parts[..i - 1].join("\\").to_lowercase();
                        let e = keys.entry(parent).or_default();
                        if !e.0.iter().any(|n| n == parts[i - 1]) {
                            e.0.push(parts[i - 1].to_string());
                        }
                    }
                }
            }
            Fake { keys }
        }

        fn with_values(mut self, key: &str, n: u32) -> Fake {
            self.keys.entry(key.to_lowercase()).or_default().1 = n;
            self
        }
    }

    impl RegistryIo for Fake {
        fn subkeys(&self, key: &KeyPath) -> Vec<String> {
            self.keys
                .get(&key.identity())
                .map(|k| k.0.clone())
                .unwrap_or_default()
        }

        fn stats(&self, key: &KeyPath) -> Option<(u32, u32)> {
            let id = key.identity();
            let prefix = format!("{id}\\");
            let sub = self.keys.keys().filter(|k| k.starts_with(&prefix)).count() as u32;
            let values = self
                .keys
                .iter()
                .filter(|(k, _)| **k == id || k.starts_with(&prefix))
                .map(|(_, v)| v.1)
                .sum();
            self.keys.contains_key(&id).then_some((sub, values))
        }
    }

    fn names(publisher: &str) -> RegistryNames {
        registry_names(
            Path::new("C:/VST3/Cool Synth_x64.vst3"),
            Some(publisher),
            None,
        )
        .unwrap()
    }

    fn derive(fake: &Fake, publisher: &str) -> Vec<String> {
        derive_candidates(
            Path::new("C:/VST3/Cool Synth_x64.vst3"),
            Some(publisher.into()),
            &[],
            &|_| true,
            fake,
        )
        .into_iter()
        .map(|l| l.key)
        .collect()
    }

    #[test]
    fn parses_and_displays_keys_strictly() {
        let k = KeyPath::parse(r"hkcu\Software\Acme").unwrap();
        assert_eq!(k.display(), r"HKCU\Software\Acme");
        assert_eq!(
            KeyPath::parse(r"HKEY_LOCAL_MACHINE\SOFTWARE\Acme")
                .unwrap()
                .hive,
            Hive::Hklm
        );
        for bad in [
            "",
            "HKCU",
            r"HKCU\",
            r"HKCU\Software\\Acme",
            r"HKCU\Software\Acme\",
            r"HKCR\Acme",
            r"HKU\Acme",
            "HKCU\\Soft\nware",
            r"C:\Windows",
        ] {
            assert_eq!(KeyPath::parse(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn classify_accepts_depth_one_and_two_only() {
        let c = |s: &str| classify(&KeyPath::parse(s).unwrap());
        assert_eq!(c(r"HKCU\Software\Acme"), Some(KeyKind::Software));
        assert_eq!(c(r"HKCU\Software\Acme\Cool"), Some(KeyKind::Software));
        assert_eq!(c(r"HKLM\SOFTWARE\Acme"), Some(KeyKind::Software));
        assert_eq!(
            c(r"HKLM\SOFTWARE\WOW6432Node\Acme\Cool"),
            Some(KeyKind::Software)
        );
        assert_eq!(
            c(r"hklm\software\wow6432node\acme"),
            Some(KeyKind::Software)
        );
        // Too deep, roots themselves, other hives and other roots.
        assert_eq!(c(r"HKCU\Software\Acme\Cool\Deep"), None);
        assert_eq!(c(r"HKCU\Software"), None);
        assert_eq!(c(r"HKLM\SOFTWARE"), None);
        assert_eq!(c(r"HKLM\SOFTWARE\WOW6432Node"), None);
        assert_eq!(c(r"HKCU\Environment\Acme"), None);
        assert_eq!(c(r"HKLM\SYSTEM\Acme"), None);
    }

    #[test]
    fn classify_denies_system_roots_at_every_depth() {
        for k in [
            r"HKCU\Software\Microsoft",
            r"HKLM\SOFTWARE\Microsoft",
            r"HKLM\SOFTWARE\Microsoft\Office",
            r"HKLM\SOFTWARE\WOW6432Node\Microsoft\Office",
            r"HKLM\SOFTWARE\Windows",
            r"HKCU\Software\Classes",
            r"HKCU\Software\Classes\CLSID",
            r"HKLM\SOFTWARE\Policies",
            r"HKLM\SOFTWARE\Policies\Acme",
            r"HKLM\SOFTWARE\WOW6432Node\Wow6432Node",
            r"HKLM\SOFTWARE\Steinberg",
            r"HKCU\Software\Steinberg",
            r"HKLM\SOFTWARE\RegisteredApplications",
            r"HKLM\SOFTWARE\Clients\Mail",
            r"HKLM\SOFTWARE\VST",
            r"HKLM\SOFTWARE\Google",
        ] {
            assert_eq!(classify(&KeyPath::parse(k).unwrap()), None, "{k}");
        }
    }

    #[test]
    fn classify_uninstall_entries_only_one_level() {
        let c = |s: &str| classify(&KeyPath::parse(s).unwrap());
        let root = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
        assert_eq!(c(&format!(r"{root}\Acme Cool")), Some(KeyKind::Uninstall));
        assert_eq!(
            c(r"HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{GUID}"),
            Some(KeyKind::Uninstall)
        );
        assert_eq!(
            c(r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\X"),
            Some(KeyKind::Uninstall)
        );
        assert_eq!(c(root), None);
        assert_eq!(c(&format!(r"{root}\X\Deeper")), None);
        assert_eq!(c(r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion"), None);
        assert_eq!(
            c(r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
            None
        );
    }

    #[test]
    fn names_need_a_usable_publisher() {
        let p = Path::new("C:/VST3/Cool Synth (x64).vst3");
        assert_eq!(registry_names(p, None, None), None);
        assert_eq!(registry_names(p, Some("  "), None), None);
        assert_eq!(registry_names(p, Some("ab"), None), None);
        assert_eq!(registry_names(p, Some("Microsoft"), None), None);
        assert_eq!(registry_names(p, Some("Adobe"), None), None);
        let n = registry_names(p, Some("Acme  Audio"), Some("Acme Audio Cool Synth 1.2")).unwrap();
        assert_eq!(n.publisher, "acme audio");
        assert!(n.products.contains(&"cool synth".to_string()));
        assert!(n.products.contains(&"cool synth 1.2".to_string()));
        assert!(n.full.contains(&"acme audio cool synth".to_string()));
        assert!(n.full.contains(&"acme audio cool synth 1.2".to_string()));
    }

    #[test]
    fn names_drop_generic_or_publisher_equal_products() {
        let n = registry_names(Path::new("C:/x/Acme.vst3"), Some("Acme"), None).unwrap();
        assert!(n.products.is_empty() && n.full.is_empty());
        let n = registry_names(Path::new("C:/x/VST3.dll"), Some("Acme"), None).unwrap();
        assert!(n.products.is_empty());
        // The publisher prefix of the plugin name is stripped.
        let n = registry_names(Path::new("C:/x/Acme Cool.vst3"), Some("Acme"), None).unwrap();
        assert!(n.products.contains(&"cool".to_string()));
        assert!(n.full.contains(&"acme cool".to_string()));
    }

    #[test]
    fn finds_exact_publisher_and_publisher_product_keys() {
        let fake = Fake::new(&[
            r"HKCU\Software\Acme\Cool Synth\Settings",
            r"HKCU\Software\Acme\Other Plugin",
            r"HKCU\Software\Acme Audio Cool Synth",
            r"HKCU\Software\Acme Cool Synth Pro",
            r"HKCU\Software\Cool Synth",
            r"HKLM\SOFTWARE\ACME",
            r"HKLM\SOFTWARE\WOW6432Node\acme\cool synth",
            r"HKLM\SOFTWARE\Microsoft\Acme",
        ]);
        let mut got = derive(&fake, "Acme");
        got.sort();
        assert_eq!(
            got,
            vec![
                r"HKCU\Software\Acme",
                r"HKCU\Software\Acme\Cool Synth",
                r"HKLM\SOFTWARE\ACME",
                r"HKLM\SOFTWARE\WOW6432Node\acme",
                r"HKLM\SOFTWARE\WOW6432Node\acme\cool synth",
            ]
        );
        // "Acme Audio Cool Synth" is another publisher; "Acme Cool Synth Pro" is not an exact name.
        let mut got = derive(&fake, "Acme Audio");
        got.sort();
        assert_eq!(got, vec![r"HKCU\Software\Acme Audio Cool Synth"]);
    }

    #[test]
    fn never_returns_denied_roots_even_for_matching_publishers() {
        let fake = Fake::new(&[
            r"HKCU\Software\Microsoft\Cool Synth",
            r"HKLM\SOFTWARE\Steinberg\Cool Synth",
            r"HKCU\Software\Classes\Cool Synth",
        ]);
        assert!(derive(&fake, "Microsoft").is_empty());
        assert!(derive(&fake, "Steinberg").is_empty());
        assert!(derive(&fake, "Classes").is_empty());
        assert!(derive(&fake, "Adobe").is_empty());
    }

    #[test]
    fn product_keys_are_only_searched_below_the_publisher_key() {
        let fake = Fake::new(&[
            r"HKCU\Software\Other\Cool Synth",
            r"HKCU\Software\Other\Acme Cool Synth",
        ]);
        assert!(derive(&fake, "Acme").is_empty());
    }

    #[test]
    fn skips_keys_over_the_limits() {
        let fake = Fake::new(&[r"HKCU\Software\Acme\Cool Synth"])
            .with_values(r"HKCU\Software\Acme\Cool Synth", 501);
        // The product key has too many values; the publisher key contains it, so it is out as well.
        assert!(derive(&fake, "Acme").is_empty());
        let fake =
            Fake::new(&[r"HKCU\Software\Acme\Cool Synth"]).with_values(r"HKCU\Software\Acme", 500);
        let got = derive_candidates(
            Path::new("C:/VST3/Cool Synth.vst3"),
            Some("Acme".into()),
            &[],
            &|_| true,
            &fake,
        );
        assert_eq!(got.len(), 2);
        assert_eq!(
            got[0],
            RegistryLeftover {
                key: r"HKCU\Software\Acme".into(),
                subkeys: 1,
                values: 500
            }
        );
        assert!(within_limits(500, 500));
        assert!(!within_limits(501, 0));
        assert!(!within_limits(0, 501));
    }

    fn uninstall_entry(name: &str, uninstall: &str) -> UninstallEntry {
        UninstallEntry {
            display_name: name.into(),
            publisher: Some("Acme".into()),
            install_location: Some(r"C:\Program Files\Acme\Cool Synth".into()),
            uninstall_string: Some(uninstall.into()),
            ..Default::default()
        }
    }

    #[test]
    fn orphaned_uninstall_entry_is_reported_only_when_its_uninstaller_is_gone() {
        let key = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Acme Cool Synth";
        let keyed = vec![(
            key.to_string(),
            uninstall_entry(
                "Acme Cool Synth",
                r#""C:\Program Files\Acme\Cool Synth\unins000.exe""#,
            ),
        )];
        let plugin = "C:/Program Files/Acme/Cool Synth/Cool Synth.vst3";
        let gone = orphaned_uninstall_keys(&keyed, plugin, &|_| false);
        assert_eq!(gone.len(), 1);
        assert_eq!(gone[0].display(), key);
        assert!(orphaned_uninstall_keys(&keyed, plugin, &|_| true).is_empty());
        // msiexec entries are never orphaned.
        let msi = vec![(
            key.to_string(),
            uninstall_entry("Acme Cool Synth", "MsiExec.exe /I{GUID}"),
        )];
        assert!(orphaned_uninstall_keys(&msi, plugin, &|_| false).is_empty());
        // An entry of some other product is not selected.
        let other = "C:/Program Files/Other/Thing/Thing.vst3";
        assert!(orphaned_uninstall_keys(&keyed, other, &|_| false).is_empty());
    }

    #[test]
    fn derive_includes_the_orphaned_uninstall_key_with_its_stats() {
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSynth";
        let keyed = vec![(
            key.to_string(),
            uninstall_entry("Acme Cool Synth", r#"C:\Program Files\Acme\unins000.exe"#),
        )];
        let fake = Fake::new(&[key]).with_values(key, 7);
        let got = derive_candidates(
            Path::new("C:/Program Files/Acme/Cool Synth/Cool Synth.vst3"),
            None,
            &keyed,
            &|_| false,
            &fake,
        );
        assert_eq!(
            got,
            vec![RegistryLeftover {
                key: key.into(),
                subkeys: 0,
                values: 7
            }]
        );
    }

    #[test]
    fn plan_only_accepts_reported_keys_deepest_first() {
        let found = vec![
            RegistryLeftover {
                key: r"HKCU\Software\Acme".into(),
                subkeys: 1,
                values: 0,
            },
            RegistryLeftover {
                key: r"HKCU\Software\Acme\Cool".into(),
                subkeys: 0,
                values: 2,
            },
        ];
        let req: Vec<String> = [
            r"HKCU\Software\Acme",
            r"hkcu\software\ACME\cool",
            r"HKCU\Software\Acme",
            r"HKCU\Software\Other",
            r"HKCU\Software",
            r"HKLM\SOFTWARE\Microsoft",
            "HKCU\\Software\\Acme\n",
            "nonsense",
        ]
        .map(String::from)
        .to_vec();
        let plan = plan_delete(&req, &found);
        assert_eq!(
            plan.valid.iter().map(KeyPath::display).collect::<Vec<_>>(),
            vec![r"HKCU\software\ACME\cool", r"HKCU\Software\Acme"]
        );
        assert_eq!(
            plan.invalid,
            vec![
                r"ERR_REGISTRY_INVALID:HKCU\Software\Other".to_string(),
                r"ERR_REGISTRY_INVALID:HKCU\Software".to_string(),
                r"ERR_REGISTRY_INVALID:HKLM\SOFTWARE\Microsoft".to_string(),
                "ERR_REGISTRY_INVALID:HKCU\\Software\\Acme\n".to_string(),
                "ERR_REGISTRY_INVALID:nonsense".to_string(),
            ]
        );
    }

    #[test]
    fn plan_refuses_reported_keys_that_fail_the_structural_check() {
        // Even if a bug reported it, a denied key is never planned.
        let found = vec![RegistryLeftover {
            key: r"HKLM\SOFTWARE\Microsoft\Office".into(),
            subkeys: 0,
            values: 0,
        }];
        let plan = plan_delete(&[r"HKLM\SOFTWARE\Microsoft\Office".into()], &found);
        assert!(plan.valid.is_empty());
        assert_eq!(plan.invalid.len(), 1);
    }

    #[test]
    fn backup_names_are_safe() {
        assert_eq!(
            backup_folder_name(1700000000, Path::new("C:/x/Cool Synth (x64).vst3")),
            "1700000000-Cool_Synth__x64_"
        );
        assert_eq!(
            backup_folder_name(1, Path::new("C:/x/..\\..\\evil.vst3")),
            "1-______evil"
        );
        let k = KeyPath::parse(r"HKLM\SOFTWARE\Acme\Cool Synth").unwrap();
        assert_eq!(
            backup_file_name(0, &k),
            "01-HKLM_SOFTWARE_Acme_Cool_Synth.reg"
        );
        assert!(backup_file_name(11, &k).starts_with("12-"));
        assert!(
            backup_file_name(
                0,
                &KeyPath::parse(&format!(r"HKCU\{}", "a".repeat(300))).unwrap()
            )
            .len()
                < 120
        );
    }

    #[test]
    fn reg_export_command_is_an_argument_vector() {
        let k = KeyPath::parse(r"HKCU\Software\Acme & Co").unwrap();
        assert_eq!(
            reg_export_args(&k, r"C:\data\registry-backups\1\01.reg"),
            vec![
                "export",
                r"HKCU\Software\Acme & Co",
                r"C:\data\registry-backups\1\01.reg",
                "/y"
            ]
        );
    }

    #[test]
    fn delete_script_uses_literal_paths_and_logs_by_index() {
        let keys = vec![
            KeyPath::parse(r"HKLM\SOFTWARE\Acme").unwrap(),
            KeyPath::parse(r"HKLM\SOFTWARE\WOW6432Node\O'Brien $(calc)").unwrap(),
        ];
        let s = build_registry_delete_script(&keys, r"C:\Temp\it's.log");
        assert!(s.contains(r"'HKLM:\SOFTWARE\Acme','HKLM:\SOFTWARE\WOW6432Node\O''Brien $(calc)'"));
        assert!(s.contains(r"$log='C:\Temp\it''s.log'"));
        assert!(s.contains("Remove-Item -LiteralPath $k -Recurse -Force"));
        assert!(s.contains(r#""OK|$i""#) && s.contains(r#""ERR|$i|$m""#));
        assert!(s.starts_with("$ErrorActionPreference='Stop'"));
        // Key names are never written to the log.
        assert!(!s.contains("Add-Content -LiteralPath $log -Value $k"));
    }

    #[test]
    fn script_fits_the_encoded_command_cap_for_the_maximum_batch() {
        let keys: Vec<KeyPath> = (0..MAX_KEYS_PER_CALL)
            .map(|i| KeyPath::parse(&format!(r"HKLM\SOFTWARE\{}{i}", "A".repeat(60))).unwrap())
            .collect();
        let script =
            build_registry_delete_script(&keys, r"C:\Users\x\AppData\Local\Temp\pu-trash-1-0.log");
        let cmd = crate::uninstall::elevated_launch_command(&script).unwrap();
        assert!(cmd.contains("-EncodedCommand"));
        assert!(cmd.len() < 32_000);
        // A script over the cap is refused.
        let huge = "x".repeat(40_000);
        assert_eq!(
            crate::uninstall::elevated_launch_command(&huge),
            Err("ERR_INVALID_PATH".to_string())
        );
    }

    #[test]
    fn registry_log_failures_are_mapped_to_registry_codes() {
        let keys = vec![
            KeyPath::parse(r"HKLM\SOFTWARE\A1").unwrap(),
            KeyPath::parse(r"HKLM\SOFTWARE\B2").unwrap(),
            KeyPath::parse(r"HKLM\SOFTWARE\C3").unwrap(),
        ];
        let log = "OK|0\nERR|1|Access denied (5)\n";
        assert_eq!(
            parse_registry_log(log, &keys),
            vec![
                r"ERR_REGISTRY_DELETE_FAILED(Access denied  5):HKLM\SOFTWARE\B2".to_string(),
                r"ERR_REGISTRY_DELETE_FAILED(no result):HKLM\SOFTWARE\C3".to_string(),
            ]
        );
        assert_eq!(
            delete_failure("bad (thing)\nhere", &keys[0]),
            r"ERR_REGISTRY_DELETE_FAILED(bad thing here):HKLM\SOFTWARE\A1"
        );
    }

    #[test]
    fn serializes_camel_case() {
        let r = RegistryDeleteResult {
            deleted: 2,
            failures: vec![],
            backup_dir: Some("C:\\b".into()),
        };
        assert_eq!(
            serde_json::to_string(&r).unwrap(),
            r#"{"deleted":2,"failures":[],"backupDir":"C:\\b"}"#
        );
        let l = RegistryLeftover {
            key: "HKCU\\Software\\A".into(),
            subkeys: 1,
            values: 2,
        };
        assert_eq!(
            serde_json::to_string(&l).unwrap(),
            r#"{"key":"HKCU\\Software\\A","subkeys":1,"values":2}"#
        );
    }

    #[test]
    fn names_helper_matches_exact_names_only() {
        let n = names("Acme");
        assert!(software_key_matches(&["ACME"], &n));
        assert!(software_key_matches(&["Acme  Cool   Synth"], &n));
        assert!(software_key_matches(&["Acme", "cool synth"], &n));
        assert!(!software_key_matches(&["Acme Audio"], &n));
        assert!(!software_key_matches(&["Cool Synth"], &n));
        assert!(!software_key_matches(&["Other", "Cool Synth"], &n));
        assert!(!software_key_matches(&["Acme", "Cool Synth", "Deep"], &n));
    }
}
