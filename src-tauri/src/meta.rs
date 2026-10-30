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
    /// CPU architecture: "x86", "x64", "arm64", "universal", "mixed" or "unknown"; `None` when the path is missing.
    pub arch: Option<String>,
    /// "ok", "empty" or "missing-binary"; `None` when the path is missing.
    pub health: Option<String>,
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

/// Bytes read from the start of each candidate binary.
const HEADER_BYTES: u64 = 4096;
/// Files are read up to three directory levels below `Contents/` (the walk starts at depth 1).
const ARCH_MAX_DEPTH: usize = 4;
/// Maximum number of entries visited per bundle during architecture detection.
const ARCH_MAX_ENTRIES: usize = 2_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Arch {
    X86,
    X64,
    Arm64,
}

/// Result of sniffing one binary header.
#[derive(Debug, PartialEq, Eq)]
struct Sniff {
    archs: Vec<Arch>,
    macho: bool,
}

fn u16_at(b: &[u8], off: usize, be: bool) -> Option<u16> {
    let a: [u8; 2] = b.get(off..off + 2)?.try_into().ok()?;
    Some(if be {
        u16::from_be_bytes(a)
    } else {
        u16::from_le_bytes(a)
    })
}

fn u32_at(b: &[u8], off: usize, be: bool) -> Option<u32> {
    let a: [u8; 4] = b.get(off..off + 4)?.try_into().ok()?;
    Some(if be {
        u32::from_be_bytes(a)
    } else {
        u32::from_le_bytes(a)
    })
}

fn macho_cpu(cputype: u32) -> Option<Arch> {
    match cputype {
        7 => Some(Arch::X86),
        0x0100_0007 => Some(Arch::X64),
        0x0100_000c => Some(Arch::Arm64),
        _ => None,
    }
}

fn sniff_pe(b: &[u8]) -> Option<Arch> {
    if b.get(0..2)? != b"MZ" {
        return None;
    }
    let pe = u32_at(b, 0x3C, false)? as usize;
    if b.get(pe..pe.checked_add(4)?)? != b"PE\0\0" {
        return None;
    }
    match u16_at(b, pe + 4, false)? {
        0x014c => Some(Arch::X86),
        0x8664 => Some(Arch::X64),
        0xAA64 => Some(Arch::Arm64),
        _ => None,
    }
}

fn sniff_elf(b: &[u8]) -> Option<Arch> {
    if b.get(0..4)? != b"\x7fELF" {
        return None;
    }
    let be = match *b.get(5)? {
        1 => false,
        2 => true,
        _ => return None,
    };
    match u16_at(b, 18, be)? {
        3 => Some(Arch::X86),
        62 => Some(Arch::X64),
        183 => Some(Arch::Arm64),
        _ => None,
    }
}

fn sniff_macho(b: &[u8]) -> Option<Vec<Arch>> {
    let magic = u32_at(b, 0, true)?;
    match magic {
        // Thin binaries; the header is in the file's own byte order.
        0xfeed_face | 0xfeed_facf | 0xcefa_edfe | 0xcffa_edfe => {
            let be = magic == 0xfeed_face || magic == 0xfeed_facf;
            Some(vec![macho_cpu(u32_at(b, 4, be)?)?])
        }
        // Fat binaries are always big-endian.
        0xcafe_babe | 0xcafe_babf => {
            let entry = if magic == 0xcafe_babe { 20 } else { 32 };
            let n = u32_at(b, 4, true)? as usize;
            // Java class files share the 0xcafebabe magic; real fat files have few slices.
            if n == 0 || n > 16 {
                return None;
            }
            let mut out = Vec::new();
            for i in 0..n {
                let ct = u32_at(b, 8 + i * entry, true)?;
                if let Some(a) = macho_cpu(ct) {
                    if !out.contains(&a) {
                        out.push(a);
                    }
                }
            }
            if out.is_empty() {
                None
            } else {
                Some(out)
            }
        }
        _ => None,
    }
}

/// Identifies PE, ELF or Mach-O from the first bytes of a file.
fn sniff(b: &[u8]) -> Option<Sniff> {
    if let Some(a) = sniff_pe(b).or_else(|| sniff_elf(b)) {
        return Some(Sniff {
            archs: vec![a],
            macho: false,
        });
    }
    sniff_macho(b).map(|archs| Sniff { archs, macho: true })
}

fn read_header(path: &Path) -> Option<Vec<u8>> {
    use std::io::Read;
    let mut buf = Vec::new();
    fs::File::open(path)
        .ok()?
        .take(HEADER_BYTES)
        .read_to_end(&mut buf)
        .ok()?;
    Some(buf)
}

/// Collects sniff results of regular files below `dir` (symlinks are never followed).
fn collect_sniffs(dir: &Path, depth: usize, budget: &mut usize, out: &mut Vec<Sniff>) {
    let Ok(read) = fs::read_dir(dir) else { return };
    for entry in read.flatten() {
        if *budget == 0 {
            return;
        }
        *budget -= 1;
        let Ok(md) = entry.metadata() else { continue };
        let ft = md.file_type();
        if ft.is_symlink() {
            continue;
        }
        if ft.is_dir() {
            if depth < ARCH_MAX_DEPTH {
                collect_sniffs(&entry.path(), depth + 1, budget, out);
            }
        } else if ft.is_file() {
            if let Some(s) = read_header(&entry.path()).as_deref().and_then(sniff) {
                out.push(s);
            }
        }
    }
}

/// Reduces the sniffed binaries to a single architecture label.
fn reduce(sniffs: &[Sniff]) -> &'static str {
    let mut set: Vec<Arch> = Vec::new();
    for a in sniffs.iter().flat_map(|s| s.archs.iter()) {
        if !set.contains(a) {
            set.push(*a);
        }
    }
    match set.as_slice() {
        [] => "unknown",
        [Arch::X86] => "x86",
        [Arch::X64] => "x64",
        [Arch::Arm64] => "arm64",
        _ if sniffs.iter().all(|s| s.macho) => "universal",
        _ => "mixed",
    }
}

fn detect_arch(p: &Path, is_dir: bool) -> &'static str {
    let mut sniffs = Vec::new();
    if is_dir {
        let contents = p.join("Contents");
        let root = if contents.is_dir() {
            contents
        } else {
            p.to_path_buf()
        };
        let mut budget = ARCH_MAX_ENTRIES;
        collect_sniffs(&root, 1, &mut budget, &mut sniffs);
    } else if let Some(s) = read_header(p).as_deref().and_then(sniff) {
        sniffs.push(s);
    }
    reduce(&sniffs)
}

/// Bundle subfolders of `Contents/` that never hold the plugin binary.
const NON_BINARY_DIRS: [&str; 3] = ["Resources", "_CodeSignature", "Frameworks"];

/// True when some non-empty regular file sits directly in a binary folder of the bundle
/// (`Contents/MacOS`, `Contents/x86_64-win`, ...). Only metadata is read, never file contents.
fn has_bundle_binary(contents: &Path) -> bool {
    let Ok(read) = fs::read_dir(contents) else {
        return false;
    };
    for dir in read.flatten() {
        let name = dir.file_name();
        let Ok(md) = dir.metadata() else { continue };
        if !md.is_dir() || NON_BINARY_DIRS.iter().any(|n| name == *n) {
            continue;
        }
        let Ok(files) = fs::read_dir(dir.path()) else {
            continue;
        };
        let found = files
            .flatten()
            .filter_map(|f| f.metadata().ok())
            .any(|m| m.is_file() && m.len() > 0);
        if found {
            return true;
        }
    }
    false
}

/// Integrity of a plugin: a zero-byte file or an empty folder is "empty"; a bundle (a folder with
/// `Contents/`) whose binary is absent or zero size is "missing-binary"; anything else is "ok".
fn detect_health(p: &Path, is_dir: bool, file_len: u64) -> &'static str {
    if !is_dir {
        return if file_len == 0 { "empty" } else { "ok" };
    }
    match fs::read_dir(p) {
        Ok(mut r) => {
            if r.next().is_none() {
                return "empty";
            }
        }
        Err(_) => return "ok",
    }
    let contents = p.join("Contents");
    if contents.is_dir() && !has_bundle_binary(&contents) {
        "missing-binary"
    } else {
        "ok"
    }
}

fn meta_for(path: &str) -> PluginMeta {
    let p = Path::new(path);
    let mut out = PluginMeta {
        path: path.to_string(),
        size: None,
        modified: None,
        arch: None,
        health: None,
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
    if ft.is_file() || ft.is_dir() {
        out.arch = Some(detect_arch(p, ft.is_dir()).to_string());
        out.health = Some(detect_health(p, ft.is_dir(), md.len()).to_string());
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
            arch: Some("x64".into()),
            health: Some("ok".into()),
        };
        assert_eq!(
            serde_json::to_string(&m).unwrap(),
            r#"{"path":"p","size":1,"modified":null,"arch":"x64","health":"ok"}"#
        );
    }

    fn pe(machine: u16) -> Vec<u8> {
        let mut b = vec![0u8; 0x100];
        b[0..2].copy_from_slice(b"MZ");
        b[0x3C..0x40].copy_from_slice(&0x80u32.to_le_bytes());
        b[0x80..0x84].copy_from_slice(b"PE\0\0");
        b[0x84..0x86].copy_from_slice(&machine.to_le_bytes());
        b
    }

    fn elf(machine: u16, be: bool) -> Vec<u8> {
        let mut b = vec![0u8; 64];
        b[0..4].copy_from_slice(b"\x7fELF");
        b[4] = 2;
        b[5] = if be { 2 } else { 1 };
        let m = if be {
            machine.to_be_bytes()
        } else {
            machine.to_le_bytes()
        };
        b[18..20].copy_from_slice(&m);
        b
    }

    fn thin(magic: u32, cpu: u32) -> Vec<u8> {
        let mut b = magic.to_be_bytes().to_vec();
        // Byte-swapped magics describe little-endian files.
        let le = magic == 0xcefa_edfe || magic == 0xcffa_edfe;
        b.extend_from_slice(&if le {
            cpu.to_le_bytes()
        } else {
            cpu.to_be_bytes()
        });
        b.resize(32, 0);
        b
    }

    fn fat(magic: u32, cpus: &[u32]) -> Vec<u8> {
        let entry = if magic == 0xcafe_babe { 20 } else { 32 };
        let mut b = magic.to_be_bytes().to_vec();
        b.extend_from_slice(&(cpus.len() as u32).to_be_bytes());
        for c in cpus {
            let mut e = vec![0u8; entry];
            e[0..4].copy_from_slice(&c.to_be_bytes());
            b.extend_from_slice(&e);
        }
        b
    }

    fn label(b: &[u8]) -> &'static str {
        reduce(&sniff(b).into_iter().collect::<Vec<_>>())
    }

    #[test]
    fn sniff_pe_machines() {
        assert_eq!(label(&pe(0x014c)), "x86");
        assert_eq!(label(&pe(0x8664)), "x64");
        assert_eq!(label(&pe(0xAA64)), "arm64");
        assert_eq!(label(&pe(0x1234)), "unknown");
    }

    #[test]
    fn sniff_elf_machines_and_endianness() {
        assert_eq!(label(&elf(3, false)), "x86");
        assert_eq!(label(&elf(62, false)), "x64");
        assert_eq!(label(&elf(183, false)), "arm64");
        assert_eq!(label(&elf(183, true)), "arm64");
        assert_eq!(label(&elf(62, true)), "x64");
    }

    #[test]
    fn sniff_macho_thin_and_fat() {
        assert_eq!(label(&thin(0xfeed_face, 7)), "x86");
        assert_eq!(label(&thin(0xfeed_facf, 0x0100_0007)), "x64");
        assert_eq!(label(&thin(0xcffa_edfe, 0x0100_000c)), "arm64");
        assert_eq!(label(&thin(0xcefa_edfe, 7)), "x86");
        assert_eq!(
            label(&fat(0xcafe_babe, &[0x0100_0007, 0x0100_000c])),
            "universal"
        );
        assert_eq!(
            label(&fat(0xcafe_babf, &[0x0100_0007, 0x0100_000c])),
            "universal"
        );
        assert_eq!(label(&fat(0xcafe_babe, &[0x0100_000c])), "arm64");
    }

    #[test]
    fn garbage_is_unknown() {
        assert!(sniff(b"hello world").is_none());
        assert!(sniff(&[]).is_none());
        // A Java class header looks like a fat header with a huge slice count.
        assert!(sniff(&[0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 0x34]).is_none());
    }

    #[test]
    fn file_detection_ignores_extension() {
        let d = tmp("archfile");
        let f = d.join("a.txt");
        fs::write(&f, pe(0x8664)).unwrap();
        assert_eq!(meta_for(f.to_str().unwrap()).arch.as_deref(), Some("x64"));
        let g = d.join("b.dll");
        fs::write(&g, b"not a binary").unwrap();
        assert_eq!(
            meta_for(g.to_str().unwrap()).arch.as_deref(),
            Some("unknown")
        );
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn bundle_arch_single_mixed_and_unknown() {
        let d = tmp("archbundle");
        let a = d.join("A.vst3");
        write(&a.join("Contents/Resources/x.bin"), 10);
        fs::write(a.join("Contents/x86_64-win/A.vst3"), b"").ok();
        fs::create_dir_all(a.join("Contents/x86_64-win")).unwrap();
        fs::write(a.join("Contents/x86_64-win/A.vst3"), pe(0x8664)).unwrap();
        assert_eq!(meta_for(a.to_str().unwrap()).arch.as_deref(), Some("x64"));

        let m = d.join("M.vst3");
        fs::create_dir_all(m.join("Contents/x86_64-win")).unwrap();
        fs::create_dir_all(m.join("Contents/x86-win")).unwrap();
        fs::write(m.join("Contents/x86_64-win/M.vst3"), pe(0x8664)).unwrap();
        fs::write(m.join("Contents/x86-win/M.vst3"), pe(0x014c)).unwrap();
        assert_eq!(meta_for(m.to_str().unwrap()).arch.as_deref(), Some("mixed"));

        let u = d.join("U.component");
        fs::create_dir_all(u.join("Contents/MacOS")).unwrap();
        fs::write(
            u.join("Contents/MacOS/U"),
            fat(0xcafe_babe, &[0x0100_0007, 0x0100_000c]),
        )
        .unwrap();
        assert_eq!(
            meta_for(u.to_str().unwrap()).arch.as_deref(),
            Some("universal")
        );

        let e = d.join("E.vst3");
        write(&e.join("Contents/readme.txt"), 5);
        assert_eq!(
            meta_for(e.to_str().unwrap()).arch.as_deref(),
            Some("unknown")
        );
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn bundle_depth_is_limited() {
        let d = tmp("archdepth");
        let b = d.join("D.vst3");
        fs::create_dir_all(b.join("Contents/a/b/c/d")).unwrap();
        fs::write(b.join("Contents/a/b/c/d/deep"), pe(0x8664)).unwrap();
        assert_eq!(
            meta_for(b.to_str().unwrap()).arch.as_deref(),
            Some("unknown")
        );
        fs::write(b.join("Contents/a/b/c/ok"), pe(0x8664)).unwrap();
        assert_eq!(meta_for(b.to_str().unwrap()).arch.as_deref(), Some("x64"));
        let _ = fs::remove_dir_all(&d);
    }

    fn health(p: &Path) -> Option<String> {
        meta_for(p.to_str().unwrap()).health
    }

    #[test]
    fn health_of_single_files() {
        let d = tmp("healthfile");
        write(&d.join("ok.dll"), 10);
        write(&d.join("zero.dll"), 0);
        assert_eq!(health(&d.join("ok.dll")).as_deref(), Some("ok"));
        assert_eq!(health(&d.join("zero.dll")).as_deref(), Some("empty"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn health_of_bundles() {
        let d = tmp("healthbundle");
        let empty = d.join("Empty.vst3");
        fs::create_dir_all(&empty).unwrap();
        assert_eq!(health(&empty).as_deref(), Some("empty"));

        let good = d.join("Good.vst3");
        write(&good.join("Contents/x86_64-win/Good.vst3"), 10);
        write(&good.join("Contents/Resources/a.png"), 5);
        assert_eq!(health(&good).as_deref(), Some("ok"));

        let mac = d.join("Mac.component");
        write(&mac.join("Contents/MacOS/Mac"), 10);
        assert_eq!(health(&mac).as_deref(), Some("ok"));

        let nobin = d.join("NoBin.vst3");
        write(&nobin.join("Contents/Resources/a.png"), 5);
        write(&nobin.join("Contents/Info.plist"), 5);
        assert_eq!(health(&nobin).as_deref(), Some("missing-binary"));

        let zero = d.join("Zero.aaxplugin");
        write(&zero.join("Contents/x64/Zero.aaxplugin"), 0);
        assert_eq!(health(&zero).as_deref(), Some("missing-binary"));

        let nomacos = d.join("NoMac.vst");
        fs::create_dir_all(nomacos.join("Contents/MacOS")).unwrap();
        assert_eq!(health(&nomacos).as_deref(), Some("missing-binary"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn missing_path_has_no_health() {
        assert_eq!(meta_for("/definitely/not/here/N.vst3").health, None);
    }

    #[test]
    fn missing_path_has_no_arch() {
        assert_eq!(meta_for("/definitely/not/here/N.vst3").arch, None);
    }
}
