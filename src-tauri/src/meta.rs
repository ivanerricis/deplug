//! Plugin file metadata (size and modification time) for the list view.

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

/// Maximum directory depth walked inside a plugin bundle.
const MAX_DEPTH: usize = 24;
/// Maximum number of entries visited per plugin, so a huge tree cannot stall the scan.
const MAX_ENTRIES: usize = 50_000;
/// Maximum number of paths answered per call.
const MAX_PATHS: usize = 2_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMeta {
    pub path: String,
    /// Total size in bytes; for bundle directories the sum of their files.
    pub size: Option<u64>,
    /// Last modification time as unix seconds.
    pub modified: Option<u64>,
}

fn unix_secs(md: &fs::Metadata) -> Option<u64> {
    md.modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

/// Sums file sizes below `dir` without following symlinks; unreadable entries count as zero.
fn dir_size(dir: &Path, depth: usize, budget: &mut usize) -> u64 {
    if depth > MAX_DEPTH {
        return 0;
    }
    let Ok(read) = fs::read_dir(dir) else {
        return 0;
    };
    let mut total = 0u64;
    for entry in read.flatten() {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        // `DirEntry::metadata` does not traverse symlinks.
        let Ok(md) = entry.metadata() else { continue };
        let ft = md.file_type();
        if ft.is_symlink() {
            continue;
        }
        if ft.is_dir() {
            total = total.saturating_add(dir_size(&entry.path(), depth + 1, budget));
        } else if ft.is_file() {
            total = total.saturating_add(md.len());
        }
    }
    total
}

fn meta_for(path: &str) -> PluginMeta {
    let p = Path::new(path);
    let mut out = PluginMeta {
        path: path.to_string(),
        size: None,
        modified: None,
    };
    let Ok(md) = fs::symlink_metadata(p) else {
        return out;
    };
    out.modified = unix_secs(&md);
    let ft = md.file_type();
    if ft.is_file() {
        out.size = Some(md.len());
    } else if ft.is_dir() {
        let mut budget = MAX_ENTRIES;
        out.size = Some(dir_size(p, 0, &mut budget));
    }
    out
}

/// Size and modification time for each path; missing or unreadable paths yield `None` fields.
#[tauri::command]
pub async fn plugin_meta(paths: Vec<String>) -> Vec<PluginMeta> {
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .iter()
            .take(MAX_PATHS)
            .map(|p| meta_for(p))
            .collect::<Vec<_>>()
    })
    .await
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("deplug-meta-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn write(path: &Path, bytes: usize) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::File::create(path)
            .unwrap()
            .write_all(&vec![0u8; bytes])
            .unwrap();
    }

    #[test]
    fn file_size_and_mtime() {
        let d = tmp("file");
        let f = d.join("a.dll");
        write(&f, 1234);
        let m = meta_for(f.to_str().unwrap());
        assert_eq!(m.size, Some(1234));
        assert!(m.modified.is_some());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn bundle_sums_recursively() {
        let d = tmp("bundle");
        let b = d.join("X.vst3");
        write(&b.join("Contents/a.bin"), 100);
        write(&b.join("Contents/x86_64/b.bin"), 250);
        let m = meta_for(b.to_str().unwrap());
        assert_eq!(m.size, Some(350));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn missing_path_is_none() {
        let m = meta_for("/definitely/not/here/Nothing.vst3");
        assert_eq!(m.size, None);
        assert_eq!(m.modified, None);
    }

    #[test]
    fn empty_bundle_is_zero() {
        let d = tmp("empty");
        let b = d.join("E.vst3");
        fs::create_dir_all(&b).unwrap();
        assert_eq!(meta_for(b.to_str().unwrap()).size, Some(0));
        let _ = fs::remove_dir_all(&d);
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_are_not_followed() {
        let d = tmp("symlink");
        let big = d.join("big");
        write(&big.join("huge.bin"), 5000);
        let b = d.join("S.vst3");
        write(&b.join("a.bin"), 10);
        std::os::unix::fs::symlink(&big, b.join("link")).unwrap();
        // A cycle must not hang either.
        std::os::unix::fs::symlink(&b, b.join("loop")).unwrap();
        assert_eq!(meta_for(b.to_str().unwrap()).size, Some(10));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn depth_is_capped() {
        let d = tmp("deep");
        let mut p = d.join("D.vst3");
        for i in 0..(MAX_DEPTH + 5) {
            p = p.join(format!("d{i}"));
        }
        write(&p.join("deep.bin"), 77);
        write(&d.join("D.vst3/top.bin"), 3);
        assert_eq!(meta_for(d.join("D.vst3").to_str().unwrap()).size, Some(3));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn serializes_camel_case() {
        let m = PluginMeta {
            path: "p".into(),
            size: Some(1),
            modified: None,
        };
        assert_eq!(
            serde_json::to_string(&m).unwrap(),
            r#"{"path":"p","size":1,"modified":null}"#
        );
    }
}
