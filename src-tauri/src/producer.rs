//! Producer (vendor) name of a plugin, read from its own metadata first and from the Windows
//! installed-program entry second. Nothing is ever loaded or executed: only small files and the
//! version resource of PE binaries are read as plain bytes.

use std::cell::OnceCell;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use crate::vendor::{publisher_from_entries, UninstallEntry};

/// Largest `moduleinfo.json` / `Info.plist` that is read.
const MAX_TEXT_FILE: u64 = 256 * 1024;
/// Largest resource section read from a PE binary.
const MAX_RSRC: usize = 8 * 1024 * 1024;
/// Longest producer name accepted; anything longer is not a name.
const MAX_NAME_CHARS: usize = 120;
/// Bytes read from the start of a PE file to find its headers.
const PE_HEAD: usize = 16 * 1024;

const RT_VERSION: u32 = 16;

fn clean(name: &str) -> Option<String> {
    let t = name.trim().trim_matches('\0').trim();
    (!t.is_empty() && t.chars().count() <= MAX_NAME_CHARS).then(|| t.to_string())
}

fn read_small(path: &Path) -> Option<Vec<u8>> {
    let md = fs::symlink_metadata(path).ok()?;
    if !md.is_file() || md.len() > MAX_TEXT_FILE {
        return None;
    }
    fs::read(path).ok()
}

// ---------------------------------------------------------------------------------------------
// VST3 moduleinfo.json
// ---------------------------------------------------------------------------------------------

/// Removes `//` and `/* */` comments (outside strings) and trailing commas, so the loose JSON
/// that some plugin SDKs write can be parsed.
pub fn relax_json(src: &str) -> String {
    let src = src.trim_start_matches('\u{feff}');
    let chars: Vec<char> = src.chars().collect();
    let mut out = String::with_capacity(src.len());
    let mut i = 0;
    let mut in_str = false;
    while i < chars.len() {
        let c = chars[i];
        if in_str {
            out.push(c);
            if c == '\\' && i + 1 < chars.len() {
                out.push(chars[i + 1]);
                i += 1;
            } else if c == '"' {
                in_str = false;
            }
        } else if c == '"' {
            in_str = true;
            out.push(c);
        } else if c == '/' && chars.get(i + 1) == Some(&'/') {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        } else if c == '/' && chars.get(i + 1) == Some(&'*') {
            i += 2;
            while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i += 2;
            continue;
        } else if c == ',' {
            // Drop the comma when the next significant character closes the container.
            let next = chars[i + 1..].iter().find(|ch| !ch.is_whitespace());
            if !matches!(next, Some('}') | Some(']')) {
                out.push(c);
            }
        } else {
            out.push(c);
        }
        i += 1;
    }
    out
}

/// `Factory Info` -> `Vendor` of a moduleinfo.json text.
pub fn vendor_from_moduleinfo_text(text: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(&relax_json(text)).ok()?;
    clean(json.get("Factory Info")?.get("Vendor")?.as_str()?)
}

/// Vendor from a VST3 bundle's `Contents/moduleinfo.json`.
pub fn vendor_from_moduleinfo(bundle: &Path) -> Option<String> {
    let bytes = read_small(&bundle.join("Contents").join("moduleinfo.json"))?;
    vendor_from_moduleinfo_text(&String::from_utf8_lossy(&bytes))
}

// ---------------------------------------------------------------------------------------------
// macOS Info.plist
// ---------------------------------------------------------------------------------------------

fn unescape_xml(s: &str) -> String {
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

/// The `<string>` value that follows `<key>name</key>` in an XML plist; binary plists give `None`.
pub fn plist_string(xml: &str, name: &str) -> Option<String> {
    let marker = format!("<key>{name}</key>");
    let rest = &xml[xml.find(&marker)? + marker.len()..];
    let rest = rest.trim_start();
    let rest = rest.strip_prefix("<string>")?;
    Some(unescape_xml(&rest[..rest.find("</string>")?]))
}

/// Second label of a reverse-DNS identifier: `com.fabfilter.proq3` -> `fabfilter`.
pub fn vendor_from_bundle_id(id: &str) -> Option<String> {
    let labels: Vec<&str> = id.trim().split('.').collect();
    if labels.len() < 3 {
        return None;
    }
    let tld = labels[0];
    if tld.len() > 3 || !tld.chars().all(|c| c.is_ascii_alphabetic()) {
        return None;
    }
    let label = labels[1];
    let ok = !label.is_empty()
        && label
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_');
    ok.then(|| label.to_string())
}

fn vendor_from_plist(bundle: &Path) -> Option<String> {
    let bytes = read_small(&bundle.join("Contents").join("Info.plist"))?;
    if bytes.starts_with(b"bplist") {
        return None;
    }
    let text = String::from_utf8_lossy(&bytes);
    vendor_from_bundle_id(&plist_string(&text, "CFBundleIdentifier")?).and_then(|v| clean(&v))
}

// ---------------------------------------------------------------------------------------------
// PE version resource (CompanyName)
// ---------------------------------------------------------------------------------------------

fn le16(b: &[u8], off: usize) -> Option<u32> {
    Some(u16::from_le_bytes(b.get(off..off.checked_add(2)?)?.try_into().ok()?) as u32)
}

fn le32(b: &[u8], off: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        b.get(off..off.checked_add(4)?)?.try_into().ok()?,
    ))
}

/// Entries `(name_or_id, target)` of the resource directory at `off`.
fn rsrc_entries(buf: &[u8], off: usize) -> Option<Vec<(u32, u32)>> {
    let n = le16(buf, off + 12)? + le16(buf, off + 14)?;
    if n > 512 {
        return None;
    }
    (0..n as usize)
        .map(|i| {
            let e = off + 16 + i * 8;
            Some((le32(buf, e)?, le32(buf, e + 4)?))
        })
        .collect()
}

/// Follows the first entry of each directory level below the RT_VERSION type and returns the
/// bytes of the version block. `rsrc` is the resource section, `va` its virtual address.
fn version_block(rsrc: &[u8], va: u32, dir_off: usize) -> Option<&[u8]> {
    let ty = rsrc_entries(rsrc, dir_off)?
        .into_iter()
        .find(|(id, _)| *id == RT_VERSION)?;
    let mut target = ty.1;
    for _ in 0..2 {
        // Name level, then language level.
        if target & 0x8000_0000 == 0 {
            break;
        }
        let dir = dir_off + (target & 0x7fff_ffff) as usize;
        target = rsrc_entries(rsrc, dir)?.first()?.1;
    }
    if target & 0x8000_0000 != 0 {
        return None;
    }
    let data = dir_off + target as usize;
    let rva = le32(rsrc, data)?;
    let size = le32(rsrc, data + 4)? as usize;
    let start = rva.checked_sub(va)? as usize;
    rsrc.get(start..start.checked_add(size.min(64 * 1024))?)
}

/// `CompanyName` value of a `VS_VERSIONINFO` block. The StringTable entries are
/// `{length, valueLength, type, UTF-16 key, pad to 4, UTF-16 value}`.
pub fn company_name_from_version_block(block: &[u8]) -> Option<String> {
    let key: Vec<u8> = "CompanyName\0"
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let at = block.windows(key.len()).position(|w| w == key.as_slice())?;
    let mut pos = at + key.len();
    pos = (pos + 3) & !3;
    let mut units = Vec::new();
    while let Some(u) = le16(block, pos) {
        if u == 0 || units.len() >= MAX_NAME_CHARS + 8 {
            break;
        }
        units.push(u as u16);
        pos += 2;
    }
    clean(&String::from_utf16_lossy(&units))
}

/// Reads the version resource of a PE file through its section table. Only headers and the
/// resource section are read, and the file is never loaded as a library.
pub fn pe_company_name<R: Read + Seek>(r: &mut R) -> Option<String> {
    let mut head = vec![0u8; PE_HEAD];
    let n = r.read(&mut head).ok()?;
    head.truncate(n);
    if head.get(0..2)? != b"MZ" {
        return None;
    }
    let pe = le32(&head, 0x3C)? as usize;
    if head.get(pe..pe + 4)? != b"PE\0\0" {
        return None;
    }
    let sections = le16(&head, pe + 6)? as usize;
    let opt_size = le16(&head, pe + 20)? as usize;
    let opt = pe + 24;
    let dd = match le16(&head, opt)? {
        0x10b => opt + 96,
        0x20b => opt + 112,
        _ => return None,
    };
    let rsrc_rva = le32(&head, dd + 2 * 8)?;
    if rsrc_rva == 0 || sections > 96 {
        return None;
    }
    let table = opt + opt_size;
    for i in 0..sections {
        let s = table + i * 40;
        let (vsize, va) = (le32(&head, s + 8)?, le32(&head, s + 12)?);
        let (raw_size, raw_ptr) = (le32(&head, s + 16)?, le32(&head, s + 20)?);
        if rsrc_rva < va || rsrc_rva >= va.saturating_add(vsize.max(raw_size)) {
            continue;
        }
        let len = (raw_size as usize).min(MAX_RSRC);
        r.seek(SeekFrom::Start(raw_ptr as u64)).ok()?;
        let mut buf = vec![0u8; len];
        let got = read_full(r, &mut buf);
        buf.truncate(got);
        let block = version_block(&buf, va, (rsrc_rva - va) as usize)?;
        return company_name_from_version_block(block);
    }
    None
}

fn read_full<R: Read>(r: &mut R, buf: &mut [u8]) -> usize {
    let mut total = 0;
    while total < buf.len() {
        match r.read(&mut buf[total..]) {
            Ok(0) | Err(_) => break,
            Ok(n) => total += n,
        }
    }
    total
}

fn company_of_file(path: &Path) -> Option<String> {
    let mut f = fs::File::open(path).ok()?;
    pe_company_name(&mut f)
}

const BINARY_EXTS: [&str; 6] = ["dll", "vst", "vst3", "clap", "aaxplugin", "aax"];

fn has_binary_ext(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| BINARY_EXTS.iter().any(|b| e.eq_ignore_ascii_case(b)))
}

/// Windows binary of a bundle: the first plugin file in a `Contents/<x64-win|x64|x86-win|...>` folder.
fn bundle_windows_binary(bundle: &Path) -> Option<PathBuf> {
    let contents = bundle.join("Contents");
    let mut dirs: Vec<PathBuf> = fs::read_dir(&contents)
        .ok()?
        .flatten()
        .filter(|e| e.metadata().is_ok_and(|m| m.is_dir()))
        .filter(|e| {
            let n = e.file_name().to_string_lossy().to_lowercase();
            n.contains("win") || n == "x64" || n == "x86"
        })
        .map(|e| e.path())
        .collect();
    dirs.sort();
    dirs.into_iter().find_map(|d| {
        let mut files: Vec<PathBuf> = fs::read_dir(d)
            .ok()?
            .flatten()
            .filter(|e| e.metadata().is_ok_and(|m| m.is_file()))
            .map(|e| e.path())
            .filter(|p| has_binary_ext(p))
            .collect();
        files.sort();
        files.into_iter().next()
    })
}

// ---------------------------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------------------------

/// The installed-program list, read lazily at most once and only when a plugin needs it.
pub struct Programs {
    cell: OnceCell<Vec<UninstallEntry>>,
    load: fn() -> Vec<UninstallEntry>,
}

impl Programs {
    pub fn new(load: fn() -> Vec<UninstallEntry>) -> Self {
        Programs {
            cell: OnceCell::new(),
            load,
        }
    }

    /// Registry-backed on Windows, always empty elsewhere.
    pub fn system() -> Self {
        Self::new(system_entries)
    }

    fn get(&self) -> &[UninstallEntry] {
        self.cell.get_or_init(self.load)
    }
}

#[cfg(windows)]
fn system_entries() -> Vec<UninstallEntry> {
    crate::vendor::registry::read_entries()
}

#[cfg(not(windows))]
fn system_entries() -> Vec<UninstallEntry> {
    Vec::new()
}

/// Producer of a plugin: file metadata first, then the installed-program publisher.
pub fn find_vendor(path: &Path, is_dir: bool, programs: &Programs) -> Option<String> {
    let from_files = if is_dir {
        vendor_from_moduleinfo(path)
            .or_else(|| bundle_windows_binary(path).and_then(|b| company_of_file(&b)))
            .or_else(|| vendor_from_plist(path))
    } else if has_binary_ext(path) {
        company_of_file(path)
    } else {
        None
    };
    from_files.or_else(|| publisher_from_entries(programs.get(), path).and_then(|p| clean(&p)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn tmp(name: &str) -> PathBuf {
        let d =
            std::env::temp_dir().join(format!("deplug-producer-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn utf16z(s: &str) -> Vec<u8> {
        s.encode_utf16()
            .chain([0])
            .flat_map(|u| u.to_le_bytes())
            .collect()
    }

    fn pad4(v: &mut Vec<u8>) {
        while !v.len().is_multiple_of(4) {
            v.push(0);
        }
    }

    /// A StringTable entry as the linker writes it.
    fn string_entry(key: &str, value: &str) -> Vec<u8> {
        let mut e = vec![0u8; 6];
        e[4..6].copy_from_slice(&1u16.to_le_bytes());
        e.extend(utf16z(key));
        pad4(&mut e);
        e.extend(utf16z(value));
        pad4(&mut e);
        let len = e.len() as u16;
        e[0..2].copy_from_slice(&len.to_le_bytes());
        e
    }

    fn version_blob(company: &str) -> Vec<u8> {
        let mut b = vec![0u8; 6];
        b.extend(utf16z("VS_VERSION_INFO"));
        pad4(&mut b);
        b.extend([0u8; 52]); // VS_FIXEDFILEINFO
        b.extend(string_entry("FileDescription", "Some plugin"));
        b.extend(string_entry("CompanyName", company));
        b.extend(string_entry("ProductName", "Pro"));
        b
    }

    /// A tiny PE32+ with one `.rsrc` section holding a version resource.
    fn synthetic_pe(company: &str, pe32: bool) -> Vec<u8> {
        let (va, raw_ptr) = (0x3000u32, 0x400u32);
        let blob = version_blob(company);
        let mut rsrc = Vec::new();
        let dir = |entries: &[(u32, u32)]| {
            let mut d = vec![0u8; 12];
            d.extend(0u16.to_le_bytes());
            d.extend((entries.len() as u16).to_le_bytes());
            for (id, off) in entries {
                d.extend(id.to_le_bytes());
                d.extend(off.to_le_bytes());
            }
            d
        };
        // type dir @0 -> name dir @0x20 -> lang dir @0x38 -> data entry @0x50 -> blob @0x60
        rsrc.extend(dir(&[
            (3, 0x8000_0000 | 0x100),
            (RT_VERSION, 0x8000_0000 | 0x20),
        ]));
        rsrc.resize(0x20, 0);
        rsrc.extend(dir(&[(1, 0x8000_0000 | 0x38)]));
        rsrc.extend(dir(&[(0x409, 0x50)]));
        rsrc.extend((va + 0x60).to_le_bytes());
        rsrc.extend((blob.len() as u32).to_le_bytes());
        rsrc.extend([0u8; 8]);
        rsrc.resize(0x60, 0);
        rsrc.extend(&blob);

        let mut f = vec![0u8; 0x80];
        f[0..2].copy_from_slice(b"MZ");
        f[0x3C..0x40].copy_from_slice(&0x80u32.to_le_bytes());
        f.extend(b"PE\0\0");
        let mut coff = vec![0u8; 20];
        coff[0..2].copy_from_slice(&0x8664u16.to_le_bytes());
        coff[2..4].copy_from_slice(&1u16.to_le_bytes());
        let opt_size: u16 = if pe32 { 224 } else { 240 };
        coff[16..18].copy_from_slice(&opt_size.to_le_bytes());
        f.extend(coff);
        let mut opt = vec![0u8; opt_size as usize];
        opt[0..2].copy_from_slice(&(if pe32 { 0x10bu16 } else { 0x20b }).to_le_bytes());
        let dd = if pe32 { 96 } else { 112 };
        opt[dd + 16..dd + 20].copy_from_slice(&va.to_le_bytes());
        opt[dd + 20..dd + 24].copy_from_slice(&(rsrc.len() as u32).to_le_bytes());
        f.extend(opt);
        let mut sec = vec![0u8; 40];
        sec[0..6].copy_from_slice(b".rsrc\0");
        sec[8..12].copy_from_slice(&(rsrc.len() as u32).to_le_bytes());
        sec[12..16].copy_from_slice(&va.to_le_bytes());
        sec[16..20].copy_from_slice(&(rsrc.len() as u32).to_le_bytes());
        sec[20..24].copy_from_slice(&raw_ptr.to_le_bytes());
        f.extend(sec);
        f.resize(raw_ptr as usize, 0);
        f.extend(rsrc);
        f
    }

    #[test]
    fn moduleinfo_with_comments_and_trailing_commas() {
        let text = "\u{feff}{\n // header\n \"Name\": \"A // not a comment\",\n /* block */\n \"Factory Info\": {\n  \"Vendor\": \" Acme, Inc. \",\n  \"URL\": \"http://x\",\n },\n \"Classes\": [1, 2,],\n}\n";
        assert_eq!(
            vendor_from_moduleinfo_text(text).as_deref(),
            Some("Acme, Inc.")
        );
        assert_eq!(vendor_from_moduleinfo_text("not json"), None);
        assert_eq!(
            vendor_from_moduleinfo_text(r#"{"Factory Info":{"Vendor":"  "}}"#),
            None
        );
        assert_eq!(
            vendor_from_moduleinfo_text(r#"{"Factory Info":{"Vendor":5}}"#),
            None
        );
    }

    #[test]
    fn relax_json_keeps_strings_intact() {
        let out = relax_json(r#"{"a":"x,}/*y*/","b":[1,],}"#);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["a"], "x,}/*y*/");
    }

    #[test]
    fn moduleinfo_file_is_size_capped() {
        let b = tmp("mi").join("A.vst3");
        fs::create_dir_all(b.join("Contents")).unwrap();
        let file = b.join("Contents/moduleinfo.json");
        fs::write(&file, r#"{"Factory Info":{"Vendor":"Acme"}}"#).unwrap();
        assert_eq!(vendor_from_moduleinfo(&b).as_deref(), Some("Acme"));
        let pad = " ".repeat(300 * 1024);
        fs::write(
            &file,
            format!(r#"{{"Factory Info":{{"Vendor":"Acme"}}}}{pad}"#),
        )
        .unwrap();
        assert_eq!(vendor_from_moduleinfo(&b), None);
    }

    #[test]
    fn plist_bundle_identifier() {
        let xml = "<?xml version=\"1.0\"?><plist><dict>\n<key>CFBundleName</key>\n<string>Pro-Q</string>\n<key>CFBundleIdentifier</key>\n\t<string>com.fabfilter.proq3</string></dict></plist>";
        let id = plist_string(xml, "CFBundleIdentifier").unwrap();
        assert_eq!(id, "com.fabfilter.proq3");
        assert_eq!(vendor_from_bundle_id(&id).as_deref(), Some("fabfilter"));
        assert_eq!(vendor_from_bundle_id("plugin"), None);
        assert_eq!(vendor_from_bundle_id("a.b"), None);
        assert_eq!(vendor_from_bundle_id("audio.unit.thing"), None);
        assert_eq!(
            plist_string("<key>X</key><string>a &amp; b</string>", "X").as_deref(),
            Some("a & b")
        );
        assert_eq!(plist_string(xml, "Nope"), None);
    }

    #[test]
    fn bundle_plist_used_only_without_moduleinfo_and_binary_plists_skipped() {
        let d = tmp("plist");
        let b = d.join("X.vst3");
        fs::create_dir_all(b.join("Contents")).unwrap();
        let plist = b.join("Contents/Info.plist");
        fs::write(
            &plist,
            "<key>CFBundleIdentifier</key><string>com.fabfilter.q</string>",
        )
        .unwrap();
        let programs = Programs::new(Vec::new);
        assert_eq!(
            find_vendor(&b, true, &programs).as_deref(),
            Some("fabfilter")
        );
        fs::write(
            b.join("Contents/moduleinfo.json"),
            r#"{"Factory Info":{"Vendor":"FabFilter"}}"#,
        )
        .unwrap();
        assert_eq!(
            find_vendor(&b, true, &programs).as_deref(),
            Some("FabFilter")
        );
        fs::remove_file(b.join("Contents/moduleinfo.json")).unwrap();
        fs::write(&plist, b"bplist00\x01\x02").unwrap();
        assert_eq!(find_vendor(&b, true, &programs), None);
    }

    #[test]
    fn pe_company_name_pe32_plus_and_pe32() {
        for pe32 in [false, true] {
            let pe = synthetic_pe("Native Instruments GmbH", pe32);
            assert_eq!(
                pe_company_name(&mut Cursor::new(pe)).as_deref(),
                Some("Native Instruments GmbH")
            );
        }
    }

    #[test]
    fn pe_without_version_or_garbage_gives_none() {
        assert_eq!(pe_company_name(&mut Cursor::new(vec![0u8; 100])), None);
        assert_eq!(pe_company_name(&mut Cursor::new(b"MZ".to_vec())), None);
        let mut pe = synthetic_pe("X", false);
        pe.truncate(0x410); // resource section cut short
        assert_eq!(pe_company_name(&mut Cursor::new(pe)), None);
        let blank = synthetic_pe("  ", false);
        assert_eq!(pe_company_name(&mut Cursor::new(blank)), None);
    }

    #[test]
    fn version_block_value_alignment() {
        // Odd-length key and value must still align on 4 bytes from the block start.
        let mut b = vec![0u8; 6];
        b.extend(utf16z("VS_VERSION_INFO"));
        pad4(&mut b);
        b.extend(string_entry("CompanyName", "Ab"));
        assert_eq!(company_name_from_version_block(&b).as_deref(), Some("Ab"));
        assert_eq!(
            company_name_from_version_block(&utf16z("Nothing here")),
            None
        );
    }

    #[test]
    fn single_dll_and_bundle_binary_on_any_platform() {
        let d = tmp("dll");
        let programs = Programs::new(Vec::new);
        let dll = d.join("Synth.dll");
        fs::write(&dll, synthetic_pe("Acme Audio", false)).unwrap();
        assert_eq!(
            find_vendor(&dll, false, &programs).as_deref(),
            Some("Acme Audio")
        );
        // Non-plugin extension is not read.
        let txt = d.join("Synth.txt");
        fs::write(&txt, synthetic_pe("Acme Audio", false)).unwrap();
        assert_eq!(find_vendor(&txt, false, &programs), None);
        let b = d.join("Pro.vst3");
        fs::create_dir_all(b.join("Contents/x86_64-win")).unwrap();
        fs::write(
            b.join("Contents/x86_64-win/Pro.vst3"),
            synthetic_pe("Bundle Co", false),
        )
        .unwrap();
        assert_eq!(
            find_vendor(&b, true, &programs).as_deref(),
            Some("Bundle Co")
        );
    }

    fn fake_programs() -> Vec<UninstallEntry> {
        vec![UninstallEntry {
            display_name: "Cool Synth".into(),
            publisher: Some("  Cool Audio Ltd ".into()),
            install_location: Some(r"C:\Program Files\Cool Audio\Cool Synth".into()),
            uninstall_string: Some(r"C:\Program Files\Cool Audio\Cool Synth\unins000.exe".into()),
            ..UninstallEntry::default()
        }]
    }

    #[test]
    fn registry_publisher_is_the_fallback_and_loaded_once() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static LOADS: AtomicUsize = AtomicUsize::new(0);
        fn load() -> Vec<UninstallEntry> {
            LOADS.fetch_add(1, Ordering::SeqCst);
            fake_programs()
        }
        let programs = Programs::new(load);
        let plugin = Path::new(r"C:\Program Files\Cool Audio\Cool Synth\Cool Synth.dll");
        assert_eq!(LOADS.load(Ordering::SeqCst), 0);
        // Missing file: no metadata, so the installed program answers.
        assert_eq!(
            find_vendor(plugin, false, &programs).as_deref(),
            Some("Cool Audio Ltd")
        );
        assert_eq!(
            find_vendor(plugin, false, &programs).as_deref(),
            Some("Cool Audio Ltd")
        );
        assert_eq!(LOADS.load(Ordering::SeqCst), 1);
        let other = Path::new(r"C:\Elsewhere\Other.dll");
        assert_eq!(find_vendor(other, false, &programs), None);
    }

    #[test]
    fn file_metadata_wins_over_registry() {
        let d = tmp("prio");
        let dll = d.join("Cool Synth.dll");
        fs::write(&dll, synthetic_pe("From File", false)).unwrap();
        let programs = Programs::new(|| {
            vec![UninstallEntry {
                display_name: "x".into(),
                publisher: Some("From Registry".into()),
                install_location: Some(std::env::temp_dir().to_string_lossy().to_string()),
                uninstall_string: Some("u.exe".into()),
                ..UninstallEntry::default()
            }]
        });
        assert_eq!(
            find_vendor(&dll, false, &programs).as_deref(),
            Some("From File")
        );
    }
}
