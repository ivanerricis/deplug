//! Leftover discovery (data folders a plugin left behind) and their removal.
//!
//! Security model: only directories that are a DIRECT child of a fixed allow-list of roots are
//! ever reported or trashed, the allow-list is recomputed on every call (never trusted from the
//! frontend), and a name must match EXACTLY. Symlinks are never followed.

use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use tauri::State;

use crate::portable::AppMode;
use crate::uninstall::{trash_with_system_env, validate_plugin_path};
use crate::vendor::{normalize_name, normalize_path, strip_arch_suffix};

const MAX_RESULTS: usize = 20;
const MAX_TRASH_BATCH: usize = 100;
/// Entries visited at most when summing a folder size.
const SIZE_ENTRY_CAP: usize = 20_000;
/// Folder names that must never be reported or trashed, even as a direct child of a root.
const PROTECTED_NAMES: [&str; 17] = [
    "microsoft",
    "windows",
    "apple",
    "google",
    "mozilla",
    "packages",
    "temp",
    "cache",
    "caches",
    "vst",
    "vst3",
    "plugins",
    "adobe",
    "nvidia",
    "intel",
    "amd",
    "systemd",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Leftover {
    pub path: String,
    /// Always "data" for now.
    pub kind: String,
    /// Total size in bytes; None when it could not be determined cheaply.
    pub size: Option<u64>,
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
}

/// The fixed list of folders in which leftovers are searched for. Recomputed on every call.
fn allowed_roots() -> Vec<PathBuf> {
    let env_dir = |name: &str| {
        std::env::var_os(name)
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
    };
    let mut roots = Vec::new();
    if cfg!(windows) {
        roots.extend(
            ["APPDATA", "LOCALAPPDATA", "PROGRAMDATA"]
                .iter()
                .filter_map(|n| env_dir(n)),
        );
        roots.extend(home_dir().map(|h| h.join("Documents")));
    } else if cfg!(target_os = "macos") {
        if let Some(h) = home_dir() {
            roots.push(h.join("Library/Application Support"));
            roots.push(h.join("Library/Preferences"));
            roots.push(h.join("Documents"));
        }
        roots.push(PathBuf::from("/Library/Application Support"));
    } else if let Some(h) = home_dir() {
        roots.push(h.join(".config"));
        roots.push(h.join(".local/share"));
    }
    roots
}

fn same_dir(a: &Path, b: &Path) -> bool {
    if cfg!(any(windows, target_os = "macos")) {
        normalize_path(&a.to_string_lossy()) == normalize_path(&b.to_string_lossy())
    } else {
        a == b
    }
}

fn is_protected_name(name: &str) -> bool {
    PROTECTED_NAMES.contains(&normalize_name(name).as_str())
}

/// True when `path` is an existing real directory (not a symlink) that is a direct child of one
/// of `roots`, is not a root itself, has no `..`, and does not have a protected name.
pub fn is_safe_leftover_root_child(path: &Path, roots: &[PathBuf]) -> bool {
    if !path.is_absolute()
        || path
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
    {
        return false;
    }
    let (Some(parent), Some(name)) = (path.parent(), path.file_name()) else {
        return false;
    };
    if roots.iter().any(|r| same_dir(path, r)) || !roots.iter().any(|r| same_dir(parent, r)) {
        return false;
    }
    if is_protected_name(&name.to_string_lossy()) {
        return false;
    }
    std::fs::symlink_metadata(path).is_ok_and(|m| m.is_dir() && !m.file_type().is_symlink())
}

/// Normalized names under which the plugin's data could be stored: the file stem (with and
/// without architecture suffix) and the vendor name. Too-short names are dropped.
pub fn candidate_names(plugin: &Path, vendor: Option<&str>) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    if let Some(stem) = plugin.file_stem().and_then(|s| s.to_str()) {
        names.push(normalize_name(stem));
        names.push(strip_arch_suffix(stem));
    }
    if let Some(v) = vendor {
        names.push(normalize_name(v));
    }
    let mut seen = HashSet::new();
    names.retain(|n| n.chars().count() >= 3 && !is_protected_name(n) && seen.insert(n.clone()));
    names
}

/// Vendor from a VST3 bundle's `Contents/moduleinfo.json` (`Factory Info` -> `Vendor`).
pub fn vendor_from_moduleinfo(plugin: &Path) -> Option<String> {
    let file = plugin.join("Contents").join("moduleinfo.json");
    let meta = std::fs::symlink_metadata(&file).ok()?;
    if !meta.is_file() || meta.len() > 1_000_000 {
        return None;
    }
    let json: serde_json::Value = serde_json::from_slice(&std::fs::read(&file).ok()?).ok()?;
    let v = json.get("Factory Info")?.get("Vendor")?.as_str()?.trim();
    (!v.is_empty()).then(|| v.to_string())
}

/// Searches `roots` (direct children only) for directories whose normalized name equals one of
/// `names`. Never returns the plugin itself or one of its parents.
pub fn find_in_roots(plugin: &Path, names: &[String], roots: &[PathBuf]) -> Vec<PathBuf> {
    let plugin_norm = normalize_path(&plugin.to_string_lossy());
    let mut found: Vec<PathBuf> = Vec::new();
    for root in roots {
        let Ok(rd) = std::fs::read_dir(root) else {
            continue;
        };
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !names.contains(&normalize_name(&name)) {
                continue;
            }
            let p = entry.path();
            let p_norm = normalize_path(&p.to_string_lossy());
            let covers_plugin = p_norm == plugin_norm
                || plugin_norm
                    .strip_prefix(&p_norm)
                    .is_some_and(|r| r.starts_with('/'));
            if covers_plugin
                || !is_safe_leftover_root_child(&p, roots)
                || found.iter().any(|f| same_dir(f, &p))
            {
                continue;
            }
            found.push(p);
            if found.len() >= MAX_RESULTS {
                return found;
            }
        }
    }
    found
}

/// Recursive size without following symlinks; None when the entry cap is exceeded.
pub fn dir_size_capped(dir: &Path, entry_cap: usize) -> Option<u64> {
    let mut total = 0u64;
    let mut visited = 0usize;
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else {
            continue;
        };
        for entry in rd.flatten() {
            visited += 1;
            if visited > entry_cap {
                return None;
            }
            let Ok(meta) = std::fs::symlink_metadata(entry.path()) else {
                continue;
            };
            if meta.file_type().is_symlink() {
                continue;
            }
            if meta.is_dir() {
                stack.push(entry.path());
            } else {
                total = total.saturating_add(meta.len());
            }
        }
    }
    Some(total)
}

/// Directories that look like leftovers of `path`. The plugin must still exist: its bundle
/// metadata and the registry entry are part of how the vendor name is found.
fn find_paths(path: &Path) -> Result<Vec<PathBuf>, String> {
    validate_plugin_path(path)?;
    let vendor = vendor_from_moduleinfo(path).or_else(|| crate::vendor::registry_publisher(path));
    let names = candidate_names(path, vendor.as_deref());
    Ok(find_in_roots(path, &names, &allowed_roots()))
}

fn find_blocking(path: &Path) -> Result<Vec<Leftover>, String> {
    Ok(find_paths(path)?
        .into_iter()
        .map(|p| Leftover {
            size: dir_size_capped(&p, SIZE_ENTRY_CAP),
            path: p.to_string_lossy().to_string(),
            kind: "data".into(),
        })
        .collect())
}

#[tauri::command]
pub async fn find_leftovers(path: String) -> Result<Vec<Leftover>, String> {
    tauri::async_runtime::spawn_blocking(move || find_blocking(&PathBuf::from(path)))
        .await
        .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

/// Trashes each path after re-checking it against the allow-list and against `found`, the
/// leftovers the backend itself derives for the plugin. Returns one `ERR_...:<path>` entry per
/// path that failed; an empty list means everything was trashed.
fn trash_checked(
    paths: &[String],
    roots: &[PathBuf],
    found: &[PathBuf],
    trash: &dyn Fn(&Path) -> Result<(), String>,
) -> Vec<String> {
    paths
        .iter()
        .filter_map(|s| {
            let p = Path::new(s);
            if !is_safe_leftover_root_child(p, roots) || !found.iter().any(|f| f == p) {
                return Some(format!("ERR_LEFTOVER_INVALID:{s}"));
            }
            trash(p).err().map(|e| format!("{e}:{s}"))
        })
        .collect()
}

/// Moves leftovers of `plugin_path` to the trash. Only paths the backend itself would report
/// from `find_leftovers(plugin_path)` are accepted, so the frontend cannot name arbitrary
/// folders. Must be called while the plugin still exists (before it is uninstalled).
#[tauri::command]
pub async fn trash_leftovers(
    plugin_path: String,
    paths: Vec<String>,
    mode: State<'_, AppMode>,
) -> Result<Vec<String>, String> {
    if paths.len() > MAX_TRASH_BATCH {
        return Err("ERR_INVALID_PATH".into());
    }
    let redirected = cfg!(target_os = "linux") && mode.portable;
    let original = mode.original_xdg_data_home.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let found = find_paths(&PathBuf::from(plugin_path))?;
        Ok(trash_checked(&paths, &allowed_roots(), &found, &|p| {
            trash_with_system_env(p, redirected, &original)
                .map_err(|e| format!("ERR_TRASH_FAILED({e})"))
        }))
    })
    .await
    .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

/// Deletes leftovers of `plugin_path` for good (no trash), under the same checks as
/// `trash_leftovers`: only paths the backend itself derives for the plugin, inside the allow-list.
#[tauri::command]
pub async fn delete_leftovers(
    plugin_path: String,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    if paths.len() > MAX_TRASH_BATCH {
        return Err("ERR_INVALID_PATH".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let found = find_paths(&PathBuf::from(plugin_path))?;
        Ok(trash_checked(&paths, &allowed_roots(), &found, &|p| {
            crate::uninstall::remove_permanently(p).map_err(|e| format!("ERR_DELETE_FAILED({e})"))
        }))
    })
    .await
    .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn tmp(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("deplug-lo-{}-{tag}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn candidate_names_cover_stem_suffix_and_vendor() {
        let n = candidate_names(Path::new("/p/Cool Synth (x64).vst3"), Some("Acme  Audio"));
        assert_eq!(n, vec!["cool synth (x64)", "cool synth", "acme audio"]);
        let n = candidate_names(Path::new("/p/Cool_x64.dll"), None);
        assert_eq!(n, vec!["cool_x64", "cool"]);
        // Too short and protected names are dropped.
        assert!(candidate_names(Path::new("/p/ab.dll"), Some("Microsoft")).is_empty());
    }

    #[test]
    fn reads_vendor_from_moduleinfo() {
        let d = tmp("mi").join("A.vst3");
        std::fs::create_dir_all(d.join("Contents")).unwrap();
        std::fs::write(
            d.join("Contents/moduleinfo.json"),
            r#"{"Name":"A","Factory Info":{"Vendor":" Acme ","URL":"x"}}"#,
        )
        .unwrap();
        assert_eq!(vendor_from_moduleinfo(&d).as_deref(), Some("Acme"));
        std::fs::write(d.join("Contents/moduleinfo.json"), "not json").unwrap();
        assert_eq!(vendor_from_moduleinfo(&d), None);
        assert_eq!(vendor_from_moduleinfo(&d.join("missing")), None);
    }

    #[test]
    fn finds_only_exact_directories_in_roots() {
        let base = tmp("find");
        let root = base.join("root");
        std::fs::create_dir_all(root.join("Cool Synth")).unwrap();
        std::fs::create_dir_all(root.join("Cool Synth Pro")).unwrap();
        std::fs::create_dir_all(root.join("Acme Audio/nested/Cool Synth")).unwrap();
        std::fs::write(root.join("cool"), b"file, not dir").unwrap();
        let plugin = base.join("Cool Synth x64.dll");
        std::fs::write(&plugin, b"x").unwrap();
        let names = candidate_names(&plugin, Some("acme audio"));
        let mut found = find_in_roots(&plugin, &names, std::slice::from_ref(&root));
        found.sort();
        assert_eq!(
            found,
            vec![root.join("Acme Audio"), root.join("Cool Synth")]
        );
        assert_eq!(dir_size_capped(&root.join("Acme Audio"), 100), Some(0));
    }

    #[test]
    fn never_returns_plugin_or_its_parents() {
        let base = tmp("self");
        let root = base.join("root");
        let folder = root.join("Cool Synth");
        std::fs::create_dir_all(&folder).unwrap();
        let plugin = folder.join("Cool Synth.vst3");
        std::fs::create_dir_all(&plugin).unwrap();
        let names = candidate_names(&plugin, None);
        assert!(find_in_roots(&plugin, &names, std::slice::from_ref(&root)).is_empty());
        // Plugin bundle located directly in a root: itself is skipped too.
        let direct = root.join("Direct.vst3");
        std::fs::create_dir_all(&direct).unwrap();
        let names = vec!["direct.vst3".to_string()];
        assert!(find_in_roots(&direct, &names, std::slice::from_ref(&root)).is_empty());
    }

    #[test]
    fn caps_results() {
        let base = tmp("cap");
        let root = base.join("root");
        std::fs::create_dir_all(&root).unwrap();
        let mut names = Vec::new();
        for i in 0..30 {
            let n = format!("name{i:02}");
            std::fs::create_dir_all(root.join(&n)).unwrap();
            names.push(n);
        }
        let plugin = base.join("p.dll");
        assert_eq!(find_in_roots(&plugin, &names, &[root]).len(), MAX_RESULTS);
    }

    #[test]
    fn size_sum_and_entry_cap() {
        let d = tmp("size");
        std::fs::create_dir_all(d.join("sub")).unwrap();
        std::fs::write(d.join("a"), [0u8; 10]).unwrap();
        std::fs::write(d.join("sub/b"), [0u8; 5]).unwrap();
        assert_eq!(dir_size_capped(&d, 100), Some(15));
        assert_eq!(dir_size_capped(&d, 2), None);
    }

    #[cfg(unix)]
    #[test]
    fn size_and_search_do_not_follow_symlinks() {
        let base = tmp("sym");
        let root = base.join("root");
        let outside = base.join("outside");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(outside.join("big"), [0u8; 100]).unwrap();
        std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();
        assert_eq!(dir_size_capped(&root, 100), Some(0));
        assert!(!is_safe_leftover_root_child(
            &root.join("link"),
            std::slice::from_ref(&root)
        ));
        let plugin = base.join("p.dll");
        assert!(find_in_roots(&plugin, &["link".to_string()], &[root]).is_empty());
    }

    #[test]
    fn allow_list_accepts_only_direct_child_directories() {
        let base = tmp("allow");
        let root = base.join("root");
        std::fs::create_dir_all(root.join("Vendor/deep")).unwrap();
        std::fs::create_dir_all(root.join("Microsoft")).unwrap();
        std::fs::write(root.join("file"), b"x").unwrap();
        let roots = vec![root.clone()];
        assert!(is_safe_leftover_root_child(&root.join("Vendor"), &roots));
        // Deeper, the root itself, the root's parent, files, protected and missing names.
        assert!(!is_safe_leftover_root_child(
            &root.join("Vendor/deep"),
            &roots
        ));
        assert!(!is_safe_leftover_root_child(&root, &roots));
        assert!(!is_safe_leftover_root_child(&base, &roots));
        assert!(!is_safe_leftover_root_child(&root.join("file"), &roots));
        assert!(!is_safe_leftover_root_child(
            &root.join("Microsoft"),
            &roots
        ));
        assert!(!is_safe_leftover_root_child(&root.join("missing"), &roots));
        // Parent-dir tricks and relative paths.
        assert!(!is_safe_leftover_root_child(
            &root.join("Vendor/../Vendor"),
            &roots
        ));
        assert!(!is_safe_leftover_root_child(
            &root.join("..").join("root").join("Vendor"),
            &roots
        ));
        assert!(!is_safe_leftover_root_child(Path::new("Vendor"), &roots));
        assert!(!is_safe_leftover_root_child(Path::new("/"), &roots));
        assert!(!is_safe_leftover_root_child(&root.join("Vendor"), &[]));
    }

    #[test]
    fn trash_checked_reports_invalid_and_failed_paths() {
        let base = tmp("trash");
        let root = base.join("root");
        std::fs::create_dir_all(root.join("Good")).unwrap();
        std::fs::create_dir_all(root.join("Bad")).unwrap();
        std::fs::create_dir_all(root.join("Unrelated")).unwrap();
        let roots = vec![root.clone()];
        // What the backend itself derived for the plugin: "Unrelated" is a safe root child but
        // not one of its leftovers, so the frontend must not be able to trash it.
        let found = vec![root.join("Good"), root.join("Bad")];
        let seen = RefCell::new(Vec::new());
        let paths = vec![
            root.join("Good").to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
            "/etc".to_string(),
            root.join("Unrelated").to_string_lossy().to_string(),
            root.join("Bad").to_string_lossy().to_string(),
        ];
        let res = trash_checked(&paths, &roots, &found, &|p| {
            seen.borrow_mut().push(p.to_path_buf());
            if p.ends_with("Bad") {
                Err("ERR_TRASH_FAILED(x)".into())
            } else {
                Ok(())
            }
        });
        assert_eq!(
            res,
            vec![
                format!("ERR_LEFTOVER_INVALID:{}", root.display()),
                "ERR_LEFTOVER_INVALID:/etc".to_string(),
                format!("ERR_LEFTOVER_INVALID:{}", root.join("Unrelated").display()),
                format!("ERR_TRASH_FAILED(x):{}", root.join("Bad").display()),
            ]
        );
        // Only allow-listed paths ever reached the trash function.
        assert_eq!(*seen.borrow(), vec![root.join("Good"), root.join("Bad")]);
    }

    #[test]
    fn serializes_camel_case() {
        let l = Leftover {
            path: "/a".into(),
            kind: "data".into(),
            size: Some(3),
        };
        assert_eq!(
            serde_json::to_string(&l).unwrap(),
            r#"{"path":"/a","kind":"data","size":3}"#
        );
    }
}
