//! Vendor uninstaller discovery and execution.
//!
//! Security model: the frontend only ever sends a plugin FILE PATH. The uninstall command is
//! always re-derived from the system (Windows registry / macOS `pkgutil`) inside the backend,
//! parsed by a strict pure parser, and only executed by `run_vendor_uninstaller`. No shell is
//! involved; the program is spawned with an argument vector.
#![cfg_attr(not(windows), allow(dead_code))]

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;

use crate::uninstall::validate_plugin_path;

/// Exit codes treated as success (0, "reboot required" 3010 and 1641).
const SUCCESS_EXIT_CODES: [i32; 3] = [0, 3010, 1641];
/// Upper bound for waiting on a vendor uninstaller.
const RUN_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const POLL_INTERVAL: Duration = Duration::from_millis(500);

/// Directory names that are far too broad to identify a single product.
const GENERIC_DIR_NAMES: [&str; 23] = [
    "program files",
    "program files (x86)",
    "common files",
    "vst3",
    "vst2",
    "vstplugins",
    "vstplugin",
    "vst",
    "plugins",
    "plug-ins",
    "avid",
    "windows",
    "system32",
    "syswow64",
    "programdata",
    "users",
    "appdata",
    "local",
    "roaming",
    "temp",
    "documents",
    "components",
    "audio",
];

/// What the frontend gets to see about a vendor uninstaller (display only).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VendorUninstaller {
    pub display_name: String,
    pub publisher: Option<String>,
    /// "exe" | "msi" | "pkg"
    pub kind: String,
    /// For display only; never sent back or executed.
    pub command_preview: String,
    /// "registry" | "pkgutil"
    pub source: String,
}

/// One entry of the Windows "Uninstall" registry hive.
#[derive(Debug, Clone, Default)]
pub struct UninstallEntry {
    pub display_name: String,
    pub publisher: Option<String>,
    pub install_location: Option<String>,
    pub uninstall_string: Option<String>,
    pub quiet_uninstall_string: Option<String>,
    pub display_icon: Option<String>,
    pub system_component: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Program {
    /// The system `msiexec.exe` (resolved from `%SystemRoot%` at launch time).
    Msiexec,
    /// Absolute path of an existing `.exe`.
    Exe(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCommand {
    pub program: Program,
    pub args: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Resolved {
    pub info: VendorUninstaller,
    /// None for kinds that are never executed (macOS "pkg").
    pub command: Option<ParsedCommand>,
}

// ---------------------------------------------------------------------------------------------
// Pure path helpers
// ---------------------------------------------------------------------------------------------

/// Normalizes a path string for comparison: trimmed, unquoted, lowercase, `/` separators,
/// no duplicate or trailing separators. Environment variables are NOT expanded.
pub fn normalize_path(s: &str) -> String {
    let t = s.trim().trim_matches('"').trim();
    let mut out = String::with_capacity(t.len());
    let mut prev_slash = false;
    for c in t.chars().map(|c| if c == '\\' { '/' } else { c }) {
        if c == '/' {
            if prev_slash {
                continue;
            }
            prev_slash = true;
        } else {
            prev_slash = false;
        }
        out.extend(c.to_lowercase());
    }
    if let Some(rest) = out.strip_prefix("/?/") {
        out = rest.to_string();
    }
    while out.ends_with('/') {
        out.pop();
    }
    out
}

/// Normalizes a human-readable name: lowercase, trimmed, single spaces.
pub fn normalize_name(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Removes a common architecture suffix such as `x64`, `_x64` or `(x64)` from a name.
pub fn strip_arch_suffix(name: &str) -> String {
    let n = normalize_name(name);
    for suf in [
        " (x64)", "(x64)", " (x86)", "(x86)", "_x64", "_x86", "-x64", "-x86", " x64", " x86",
    ] {
        if let Some(base) = n.strip_suffix(suf) {
            let base = base.trim();
            if !base.is_empty() {
                return base.to_string();
            }
        }
    }
    n
}

fn segment_count(norm: &str) -> usize {
    norm.split('/').filter(|s| !s.is_empty()).count()
}

fn last_segment(norm: &str) -> &str {
    norm.rsplit('/').next().unwrap_or("")
}

fn parent_of(norm: &str) -> Option<&str> {
    norm.rsplit_once('/').map(|(p, _)| p)
}

/// True when `dir` equals `path` or is one of its ancestors (both already normalized).
fn is_dir_prefix(dir: &str, path: &str) -> bool {
    !dir.is_empty() && (path == dir || path.strip_prefix(dir).is_some_and(|r| r.starts_with('/')))
}

/// Directories too broad to attribute plugins to a product (roots, "Program Files", "VST3"...).
fn is_too_generic_dir(norm: &str) -> bool {
    if segment_count(norm) < 2 {
        return true;
    }
    if GENERIC_DIR_NAMES.contains(&last_segment(norm)) {
        return true;
    }
    // Anything directly inside or equal to the Windows directory.
    norm.split('/').filter(|s| !s.is_empty()).nth(1) == Some("windows")
}

/// Generic folder/stem names that must never be matched by name.
fn is_generic_name(norm_name: &str) -> bool {
    norm_name.chars().count() < 3 || GENERIC_DIR_NAMES.contains(&norm_name)
}

fn is_windows_absolute(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && (b[2] == b'\\' || b[2] == b'/')
}

// ---------------------------------------------------------------------------------------------
// Command line parsing
// ---------------------------------------------------------------------------------------------

/// Splits a command line into the program and the rest. The program is either quoted or an
/// unquoted path ending in `.exe` (followed by end of string or whitespace).
fn split_program(cmd: &str) -> Option<(String, &str)> {
    let t = cmd.trim();
    if let Some(r) = t.strip_prefix('"') {
        let end = r.find('"')?;
        return Some((r[..end].trim().to_string(), &r[end + 1..]));
    }
    let lower = t.to_ascii_lowercase();
    let mut from = 0;
    while let Some(i) = lower[from..].find(".exe") {
        let end = from + i + 4;
        if end == t.len() || t[end..].starts_with(char::is_whitespace) {
            return Some((t[..end].to_string(), &t[end..]));
        }
        from = end;
    }
    // Bare `msiexec` without extension (e.g. `msiexec /i {GUID}`).
    let first = t.split_whitespace().next()?;
    if is_msiexec_name(first) {
        return Some((first.to_string(), &t[first.len()..]));
    }
    None
}

/// Splits arguments on whitespace; double quotes group and are removed.
fn split_args(rest: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut cur = String::new();
    let mut has_token = false;
    let mut in_quotes = false;
    for c in rest.chars() {
        match c {
            '"' => {
                in_quotes = !in_quotes;
                has_token = true;
            }
            c if c.is_whitespace() && !in_quotes => {
                if has_token {
                    args.push(std::mem::take(&mut cur));
                    has_token = false;
                }
            }
            c => {
                cur.push(c);
                has_token = true;
            }
        }
    }
    if has_token {
        args.push(cur);
    }
    args
}

fn is_msiexec_name(name: &str) -> bool {
    name.eq_ignore_ascii_case("msiexec.exe") || name.eq_ignore_ascii_case("msiexec")
}

/// `/I{GUID}` (install) becomes `/X{GUID}` (uninstall); a lone `/I` becomes `/X`.
fn rewrite_msi_arg(arg: &str) -> String {
    if arg.eq_ignore_ascii_case("/i") {
        return "/X".to_string();
    }
    if arg.len() > 2 && arg.is_char_boundary(2) && arg[..2].eq_ignore_ascii_case("/i") {
        let rest = &arg[2..];
        if rest.starts_with('{') {
            return format!("/X{rest}");
        }
    }
    arg.to_string()
}

/// Strictly parses an uninstall command line. `exists` tells whether a file exists.
/// Rejects empty/relative programs and anything that is not an existing absolute `.exe`
/// or the system msiexec. UNC paths, `..` and unexpanded `%VAR%` are rejected.
pub fn parse_command_line_with(
    cmd: &str,
    exists: &dyn Fn(&str) -> bool,
) -> Result<ParsedCommand, String> {
    const BAD: &str = "ERR_VENDOR_BAD_COMMAND";
    if cmd.chars().any(|c| c == '\0' || c == '\n' || c == '\r') {
        return Err(BAD.into());
    }
    let (prog, rest) = split_program(cmd).ok_or(BAD)?;
    if prog.is_empty() {
        return Err(BAD.into());
    }
    let program = if !prog.contains(['\\', '/']) && is_msiexec_name(&prog) {
        Program::Msiexec
    } else {
        let norm = normalize_path(&prog);
        if !is_windows_absolute(&prog)
            || prog.contains('%')
            || norm.split('/').any(|s| s == "..")
            || !norm.ends_with(".exe")
        {
            return Err(BAD.into());
        }
        if last_segment(&norm) == "msiexec.exe" {
            Program::Msiexec
        } else if exists(&prog) {
            Program::Exe(prog)
        } else {
            return Err(BAD.into());
        }
    };
    let mut args = split_args(rest);
    if program == Program::Msiexec {
        args = args.iter().map(|a| rewrite_msi_arg(a)).collect();
    }
    Ok(ParsedCommand { program, args })
}

fn command_preview(cmd: &ParsedCommand) -> String {
    let prog = match &cmd.program {
        Program::Msiexec => "msiexec.exe".to_string(),
        Program::Exe(p) => format!("\"{p}\""),
    };
    if cmd.args.is_empty() {
        prog
    } else {
        format!("{prog} {}", cmd.args.join(" "))
    }
}

// ---------------------------------------------------------------------------------------------
// Matching registry entries to a plugin
// ---------------------------------------------------------------------------------------------

/// Normalized directory of the program in a command line (None for msiexec or generic dirs).
fn command_dir(cmd: &str) -> Option<String> {
    let (prog, _) = split_program(cmd)?;
    if !prog.contains(['\\', '/']) {
        return None;
    }
    let norm = normalize_path(&prog);
    if last_segment(&norm) == "msiexec.exe" {
        return None;
    }
    parent_of(&norm).map(str::to_string)
}

/// Directory of a `DisplayIcon` value (`"C:\x\app.exe",0` / `C:\x\app.exe,0`).
fn icon_dir(icon: &str) -> Option<String> {
    let t = icon.trim();
    let t = match t.rsplit_once(',') {
        Some((p, idx))
            if idx
                .trim()
                .trim_start_matches('-')
                .chars()
                .all(|c| c.is_ascii_digit()) =>
        {
            p
        }
        _ => t,
    };
    let norm = normalize_path(t);
    parent_of(&norm).map(str::to_string)
}

fn entry_is_usable(e: &UninstallEntry) -> bool {
    !e.display_name.trim().is_empty()
        && e.uninstall_string
            .as_deref()
            .is_some_and(|s| !s.trim().is_empty())
        && !e.system_component
}

/// Best (longest) directory score if the entry's install location or executable folders are a
/// prefix of the plugin path or equal its parent folder.
fn match_score(e: &UninstallEntry, plugin_norm: &str) -> Option<usize> {
    let mut dirs: Vec<String> = Vec::new();
    if let Some(l) = e.install_location.as_deref() {
        dirs.push(normalize_path(l));
    }
    for c in [&e.uninstall_string, &e.quiet_uninstall_string]
        .into_iter()
        .flatten()
    {
        dirs.extend(command_dir(c));
    }
    if let Some(i) = e.display_icon.as_deref() {
        dirs.extend(icon_dir(i));
    }
    dirs.into_iter()
        .filter(|d| !is_too_generic_dir(d))
        .filter(|d| is_dir_prefix(d, plugin_norm) || parent_of(plugin_norm) == Some(d.as_str()))
        .map(|d| d.len())
        .max()
}

/// True when the entry's install location or uninstaller folder contains the plugin (used by the tests).
#[cfg(test)]
pub fn entry_matches_plugin(entry: &UninstallEntry, plugin_path: &str) -> bool {
    entry_is_usable(entry) && match_score(entry, &normalize_path(plugin_path)).is_some()
}

/// True for a version-like token that may trail a product name: `3`, `v2.1`, `1.3.6`, `x64`...
fn is_version_token(t: &str) -> bool {
    let core = t
        .trim_matches(|c| c == '(' || c == ')')
        .trim_start_matches('v');
    matches!(
        core,
        "x64" | "x86" | "64-bit" | "32-bit" | "64bit" | "32bit"
    ) || (!core.is_empty()
        && core.chars().all(|c| c.is_ascii_digit() || c == '.')
        && core.chars().any(|c| c.is_ascii_digit()))
}

/// True when `rest` (the tokens that follow a product name) are all version-like.
fn only_version_tokens(rest: &str) -> bool {
    !rest.is_empty() && rest.split(' ').all(is_version_token)
}

/// `name` equals `stem`, or is `stem` followed only by version tokens ("serum 1.3.6" vs "serum").
fn name_equals_or_versioned(name: &str, stem: &str) -> bool {
    name == stem
        || name
            .strip_prefix(stem)
            .and_then(|r| r.strip_prefix(' '))
            .is_some_and(only_version_tokens)
}

/// Entries named "<Publisher> <Product> [version]" (for example "Voxengo SPAN" by "Voxengo")
/// whose product is the plugin's name. Installers often register an install folder that does
/// not contain the plugin (the VST3 lives in Common Files), so the name has to carry the match.
/// Numbers that belong to the product name ("Pro-Q 3", "Kontakt 7") are kept: only a version-like
/// suffix that the plugin's own name does not have is ignored, so "Pro-Q 2" never matches "Pro-Q 3".
/// To avoid attributing another vendor's plugin of the same name, the plugin's own folder must be
/// either generic (`VST3`, `Common Files`...) or named after the publisher; entries without a
/// publisher are never matched this way.
fn publisher_product_matches(e: &UninstallEntry, plugin_norm: &str) -> bool {
    let Some(publisher) = e
        .publisher
        .as_deref()
        .map(normalize_name)
        .filter(|p| p.chars().count() >= 3)
    else {
        return false;
    };
    let file = last_segment(plugin_norm);
    let stem = strip_arch_suffix(file.rsplit_once('.').map_or(file, |(s, _)| s));
    if is_generic_name(&stem) {
        return false;
    }
    let name = normalize_name(&e.display_name);
    // The publisher may be part of the entry name, of the plugin name, of both or of neither.
    let strip_publisher = |t: &str| -> Option<String> {
        t.strip_prefix(&publisher)
            .and_then(|r| r.strip_prefix(' '))
            .map(str::to_string)
    };
    let name_variants = [Some(name.clone()), strip_publisher(&name)];
    let stem_variants = [Some(stem.clone()), strip_publisher(&stem)];
    // Needs evidence of the publisher: in the entry name, or in the plugin name.
    if name_variants[1].is_none() && stem_variants[1].is_none() {
        return false;
    }
    let names_match = name_variants.iter().flatten().any(|n| {
        stem_variants
            .iter()
            .flatten()
            .any(|s| !is_generic_name(s) && name_equals_or_versioned(n, s))
    });
    if !names_match {
        return false;
    }
    let parent = parent_of(plugin_norm).map_or("", last_segment);
    parent.is_empty() || GENERIC_DIR_NAMES.contains(&parent) || parent == publisher
}

/// Name-based fallback: the plugin stem or parent folder name equals the normalized DisplayName,
/// or the entry is "<Publisher> <Product>" for this plugin.
fn entry_name_matches(e: &UninstallEntry, plugin_norm: &str) -> bool {
    let name = normalize_name(&e.display_name);
    let mut candidates = Vec::new();
    let file = last_segment(plugin_norm);
    let stem = file.rsplit_once('.').map_or(file, |(s, _)| s);
    candidates.push(strip_arch_suffix(stem));
    candidates.push(normalize_name(stem));
    if let Some(parent) = parent_of(plugin_norm) {
        candidates.push(normalize_name(last_segment(parent)));
    }
    candidates.iter().any(|c| !is_generic_name(c) && *c == name)
        || publisher_product_matches(e, plugin_norm)
}

/// Returns the usable entries matching the plugin, best match first (longest location wins).
/// The name-based fallback is used only when nothing else matched and it is unique.
pub fn select_entries<'a>(
    entries: &'a [UninstallEntry],
    plugin_path: &str,
) -> Vec<&'a UninstallEntry> {
    let plugin_norm = normalize_path(plugin_path);
    let mut scored: Vec<(usize, &UninstallEntry)> = entries
        .iter()
        .filter(|e| entry_is_usable(e))
        .filter_map(|e| match_score(e, &plugin_norm).map(|s| (s, e)))
        .collect();
    scored.sort_by_key(|s| std::cmp::Reverse(s.0)); // stable: registry order breaks ties
    if !scored.is_empty() {
        return scored.into_iter().map(|(_, e)| e).collect();
    }
    let by_name: Vec<&UninstallEntry> = entries
        .iter()
        .filter(|e| entry_is_usable(e) && entry_name_matches(e, &plugin_norm))
        .collect();
    if by_name.len() == 1 {
        by_name
    } else {
        Vec::new()
    }
}

/// Picks the best matching entry whose command line parses and builds the result.
pub fn resolve_command(
    entries: &[UninstallEntry],
    plugin_path: &str,
    exists: &dyn Fn(&str) -> bool,
) -> Option<Resolved> {
    select_entries(entries, plugin_path)
        .into_iter()
        .find_map(|e| {
            let cmd = parse_command_line_with(e.uninstall_string.as_deref()?, exists).ok()?;
            let kind = if cmd.program == Program::Msiexec {
                "msi"
            } else {
                "exe"
            };
            Some(Resolved {
                info: VendorUninstaller {
                    display_name: e.display_name.trim().to_string(),
                    publisher: e
                        .publisher
                        .as_deref()
                        .map(str::trim)
                        .filter(|p| !p.is_empty())
                        .map(str::to_string),
                    kind: kind.into(),
                    command_preview: command_preview(&cmd),
                    source: "registry".into(),
                },
                command: Some(cmd),
            })
        })
}

/// Registry Publisher of the entry that owns the plugin (used by leftover search).
#[cfg_attr(not(windows), allow(unused_variables))]
pub fn registry_publisher(plugin: &Path) -> Option<String> {
    #[cfg(windows)]
    {
        let entries = registry::read_entries();
        select_entries(&entries, &plugin.to_string_lossy())
            .first()
            .and_then(|e| e.publisher.clone())
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
    }
    #[cfg(not(windows))]
    {
        None
    }
}

// ---------------------------------------------------------------------------------------------
// macOS: installer package owning a file
// ---------------------------------------------------------------------------------------------

/// Extracts package ids from `pkgutil --file-info` output (`pkgid: com.vendor.product` lines).
#[cfg(any(target_os = "macos", test))]
pub fn parse_pkgutil_file_info(output: &str) -> Vec<String> {
    let mut ids: Vec<String> = Vec::new();
    for line in output.lines() {
        if let Some(id) = line.trim().strip_prefix("pkgid:") {
            let id = id.trim();
            let ok = !id.is_empty()
                && id.len() <= 200
                && id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+'));
            if ok && !ids.iter().any(|i| i == id) {
                ids.push(id.to_string());
            }
        }
    }
    ids
}

#[cfg(target_os = "macos")]
fn lookup(plugin: &Path) -> Result<Option<Resolved>, String> {
    let out = std::process::Command::new("/usr/sbin/pkgutil")
        .arg("--file-info")
        .arg(plugin)
        .output()
        .map_err(|e| format!("ERR_VENDOR_LAUNCH:{e}"))?;
    if !out.status.success() {
        return Ok(None);
    }
    let ids = parse_pkgutil_file_info(&String::from_utf8_lossy(&out.stdout));
    Ok(ids.into_iter().next().map(|id| Resolved {
        info: VendorUninstaller {
            command_preview: format!("pkgutil --files {id}"),
            display_name: id,
            publisher: None,
            kind: "pkg".into(),
            source: "pkgutil".into(),
        },
        command: None,
    }))
}

#[cfg(windows)]
fn lookup(plugin: &Path) -> Result<Option<Resolved>, String> {
    let entries = registry::read_entries();
    Ok(resolve_command(&entries, &plugin.to_string_lossy(), &|p| {
        Path::new(p).is_file()
    }))
}

#[cfg(not(any(windows, target_os = "macos")))]
fn lookup(_plugin: &Path) -> Result<Option<Resolved>, String> {
    Ok(None)
}

#[cfg(windows)]
mod registry {
    use super::UninstallEntry;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    const UNINSTALL: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
    const UNINSTALL_WOW: &str = r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall";

    fn read_one(key: &RegKey) -> Option<UninstallEntry> {
        let s = |n: &str| key.get_value::<String, _>(n).ok();
        let flag = |n: &str| key.get_value::<u32, _>(n).is_ok_and(|v| v == 1);
        Some(UninstallEntry {
            display_name: s("DisplayName")?,
            publisher: s("Publisher"),
            install_location: s("InstallLocation"),
            uninstall_string: s("UninstallString"),
            quiet_uninstall_string: s("QuietUninstallString"),
            display_icon: s("DisplayIcon"),
            system_component: flag("SystemComponent"),
        })
    }

    pub fn read_entries() -> Vec<UninstallEntry> {
        let mut out = Vec::new();
        for (hive, sub) in [
            (HKEY_LOCAL_MACHINE, UNINSTALL),
            (HKEY_LOCAL_MACHINE, UNINSTALL_WOW),
            (HKEY_CURRENT_USER, UNINSTALL),
        ] {
            let Ok(root) = RegKey::predef(hive).open_subkey_with_flags(sub, KEY_READ) else {
                continue;
            };
            for name in root.enum_keys().flatten() {
                if let Ok(key) = root.open_subkey_with_flags(&name, KEY_READ) {
                    out.extend(read_one(&key));
                }
            }
        }
        out
    }
}

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

/// Maps an exit code to the stable result (0, 3010 and 1641 are success).
pub fn exit_result(code: Option<i32>) -> Result<(), String> {
    match code {
        Some(c) if SUCCESS_EXIT_CODES.contains(&c) => Ok(()),
        Some(c) => Err(format!("ERR_VENDOR_FAILED:{c}")),
        None => Err("ERR_VENDOR_FAILED:?".into()),
    }
}

#[cfg(windows)]
fn execute(cmd: &ParsedCommand) -> Result<(), String> {
    use std::process::Command;
    use std::time::Instant;

    let program: PathBuf = match &cmd.program {
        Program::Exe(p) => PathBuf::from(p),
        Program::Msiexec => {
            let root = std::env::var_os("SystemRoot").ok_or("ERR_VENDOR_BAD_COMMAND")?;
            Path::new(&root).join("System32").join("msiexec.exe")
        }
    };
    let mut command = Command::new(&program);
    command.args(&cmd.args);
    if let Some(dir) = program.parent() {
        command.current_dir(dir);
    }
    let mut child = command.spawn().map_err(|e| match e.raw_os_error() {
        // ERROR_ELEVATION_REQUIRED: the uninstaller's manifest demands administrator rights.
        Some(740) => "ERR_VENDOR_ELEVATION_REQUIRED".to_string(),
        _ => format!("ERR_VENDOR_LAUNCH:{e}"),
    })?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return exit_result(status.code()),
            Ok(None) if start.elapsed() >= RUN_TIMEOUT => return Err("ERR_VENDOR_TIMEOUT".into()),
            Ok(None) => std::thread::sleep(POLL_INTERVAL),
            Err(e) => return Err(format!("ERR_VENDOR_LAUNCH:{e}")),
        }
    }
}

#[cfg(not(windows))]
fn execute(_cmd: &ParsedCommand) -> Result<(), String> {
    Err("ERR_VENDOR_UNSUPPORTED".into())
}

fn run_blocking(path: &Path) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("ERR_VENDOR_UNSUPPORTED".into());
    }
    validate_plugin_path(path)?;
    let resolved = lookup(path)?.ok_or("ERR_VENDOR_NOT_FOUND")?;
    if !matches!(resolved.info.kind.as_str(), "exe" | "msi") {
        return Err("ERR_VENDOR_NOT_FOUND".into());
    }
    let cmd = resolved.command.ok_or("ERR_VENDOR_NOT_FOUND")?;
    execute(&cmd)
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn find_vendor_uninstaller(path: String) -> Result<Option<VendorUninstaller>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(path);
        validate_plugin_path(&p)?;
        Ok(lookup(&p)?.map(|r| r.info))
    })
    .await
    .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

/// Runs the vendor uninstaller found for this plugin. Nothing but the plugin path is accepted.
#[tauri::command]
pub async fn run_vendor_uninstaller(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || run_blocking(&PathBuf::from(path)))
        .await
        .map_err(|e| format!("ERR_INTERNAL:{e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str, loc: Option<&str>, un: Option<&str>) -> UninstallEntry {
        UninstallEntry {
            display_name: name.into(),
            install_location: loc.map(Into::into),
            uninstall_string: un.map(Into::into),
            ..Default::default()
        }
    }

    fn all_exist(_: &str) -> bool {
        true
    }

    fn voxengo() -> UninstallEntry {
        UninstallEntry {
            display_name: "Voxengo SPAN".into(),
            publisher: Some("Voxengo".into()),
            install_location: Some(r"C:\Program Files\Voxengo\Voxengo SPAN\".into()),
            uninstall_string: Some(
                r#""C:\Program Files\Voxengo\Voxengo SPAN\unins000.exe""#.into(),
            ),
            ..Default::default()
        }
    }

    #[test]
    fn matches_publisher_product_entry_for_every_span_variant() {
        // Real registry entry reported by a user: the install folder does not contain the plugins.
        let entries = vec![voxengo()];
        for p in [
            "C:/Program Files/Common Files/VST3/SPAN.vst3",
            "C:/Program Files/Common Files/VST2/Voxengo/SPAN.dll",
            "C:/Program Files (x86)/Common Files/VST2/Voxengo/SPAN.dll",
            "C:/Program Files/Common Files/Avid/Audio/Plug-Ins/SPAN.aaxplugin",
            "C:/Program Files/Common Files/VST2/Voxengo/SPAN_x64.dll",
        ] {
            let found = select_entries(&entries, p);
            assert_eq!(found.len(), 1, "{p}");
            assert_eq!(found[0].display_name, "Voxengo SPAN", "{p}");
        }
        let resolved = resolve_command(
            &entries,
            "C:/Program Files/Common Files/VST3/SPAN.vst3",
            &all_exist,
        )
        .unwrap();
        assert_eq!(resolved.info.kind, "exe");
        assert!(resolved.info.command_preview.contains("unins000.exe"));
    }

    #[test]
    fn publisher_product_match_ignores_version_and_rejects_other_vendors() {
        let mut e = voxengo();
        e.display_name = "Voxengo SPAN 3.6".into();
        assert!(publisher_product_matches(
            &e,
            "c:/program files/common files/vst3/span.vst3"
        ));
        // Another vendor's plugin with the same name must not be attributed to Voxengo.
        assert!(!publisher_product_matches(
            &e,
            "c:/program files/common files/vst2/acme/span.dll"
        ));
        // Different product of the same publisher.
        assert!(!publisher_product_matches(
            &e,
            "c:/program files/common files/vst3/crunchessor.vst3"
        ));
        // No publisher registered: no guessing.
        e.publisher = None;
        assert!(!publisher_product_matches(
            &e,
            "c:/program files/common files/vst3/span.vst3"
        ));
    }

    #[test]
    fn numbered_product_names_keep_their_number() {
        let fab = UninstallEntry {
            display_name: "FabFilter Pro-Q 3".into(),
            publisher: Some("FabFilter".into()),
            install_location: Some(r"C:\Program Files\FabFilter\Pro-Q 3".into()),
            uninstall_string: Some(r#""C:\Program Files\FabFilter\Pro-Q 3\unins000.exe""#.into()),
            ..Default::default()
        };
        let vst3 = "c:/program files/common files/vst3/fabfilter pro-q 3.vst3";
        assert!(publisher_product_matches(&fab, vst3));
        // The plugin name without the publisher prefix also matches.
        assert!(publisher_product_matches(
            &fab,
            "c:/program files/common files/vst3/pro-q 3.vst3"
        ));
        // A different major version of the same product is a different product.
        assert!(!publisher_product_matches(
            &fab,
            "c:/program files/common files/vst3/pro-q 2.vst3"
        ));
        // A plugin without the number still matches: the trailing "3" counts as a version.
        assert!(publisher_product_matches(
            &fab,
            "c:/program files/common files/vst3/pro-q.vst3"
        ));

        let ni = UninstallEntry {
            display_name: "Native Instruments Kontakt 7".into(),
            publisher: Some("Native Instruments".into()),
            uninstall_string: Some(
                r#""C:\Program Files\Native Instruments\Kontakt 7\unins000.exe""#.into(),
            ),
            ..Default::default()
        };
        assert!(publisher_product_matches(
            &ni,
            "c:/program files/common files/vst3/kontakt 7.vst3"
        ));
        assert!(!publisher_product_matches(
            &ni,
            "c:/program files/common files/vst3/kontakt 6.vst3"
        ));

        // Entry with a trailing version, plugin without the number.
        let serum = UninstallEntry {
            display_name: "Serum 1.3.6".into(),
            publisher: Some("Xfer Records".into()),
            ..Default::default()
        };
        // The publisher is neither in the entry name nor in the plugin name: no evidence, no match.
        assert!(!publisher_product_matches(
            &serum,
            "c:/program files/common files/vst3/serum.vst3"
        ));
        let serum = UninstallEntry {
            display_name: "Xfer Records Serum 1.3.6".into(),
            ..serum
        };
        assert!(publisher_product_matches(
            &serum,
            "c:/program files/common files/vst3/serum.vst3"
        ));
    }

    #[test]
    fn version_tokens() {
        for t in ["3", "v2.1", "1.3.6", "x64", "(x86)", "64-bit"] {
            assert!(is_version_token(t), "{t}");
        }
        for t in ["span", "pro", "2nd"] {
            assert!(!is_version_token(t), "{t}");
        }
    }

    #[test]
    fn normalizes_paths() {
        assert_eq!(
            normalize_path(r#""C:\Program Files\Acme\\Synth\""#),
            "c:/program files/acme/synth"
        );
        assert_eq!(normalize_path("c:/A/b/"), "c:/a/b");
        assert_eq!(normalize_path(r"\\?\C:\X"), "c:/x");
        assert_eq!(normalize_path("%ProgramFiles%\\X"), "%programfiles%/x");
        assert_eq!(normalize_path("  "), "");
    }

    #[test]
    fn strips_arch_suffixes() {
        assert_eq!(strip_arch_suffix("Synth (x64)"), "synth");
        assert_eq!(strip_arch_suffix("Synth_x64"), "synth");
        assert_eq!(strip_arch_suffix("Synth x86"), "synth");
        assert_eq!(strip_arch_suffix("Synth"), "synth");
        assert_eq!(strip_arch_suffix("x64"), "x64");
    }

    #[test]
    fn dir_prefix_is_component_wise() {
        assert!(is_dir_prefix("c:/a/b", "c:/a/b/c.dll"));
        assert!(is_dir_prefix("c:/a/b", "c:/a/b"));
        assert!(!is_dir_prefix("c:/a/b", "c:/a/bc/c.dll"));
        assert!(!is_dir_prefix("", "c:/a"));
    }

    #[test]
    fn parses_quoted_exe_with_args() {
        let c = parse_command_line_with(
            r#""C:\Program Files\Acme Synth\unins000.exe" /SILENT /LOG="C:\a b\x.log""#,
            &all_exist,
        )
        .unwrap();
        assert_eq!(
            c.program,
            Program::Exe(r"C:\Program Files\Acme Synth\unins000.exe".into())
        );
        assert_eq!(c.args, vec!["/SILENT", r"/LOG=C:\a b\x.log"]);
    }

    #[test]
    fn parses_unquoted_exe_with_spaces() {
        let c =
            parse_command_line_with(r"C:\Program Files\Acme\uninstall.exe -x", &all_exist).unwrap();
        assert_eq!(
            c.program,
            Program::Exe(r"C:\Program Files\Acme\uninstall.exe".into())
        );
        assert_eq!(c.args, vec!["-x"]);
        let c = parse_command_line_with(r"C:\Acme\uninstall.exe", &all_exist).unwrap();
        assert!(c.args.is_empty());
    }

    #[test]
    fn rewrites_msi_install_to_uninstall() {
        let g = "{11111111-2222-3333-4444-555555555555}";
        let c = parse_command_line_with(&format!("MsiExec.exe /I{g}"), &all_exist).unwrap();
        assert_eq!(c.program, Program::Msiexec);
        assert_eq!(c.args, vec![format!("/X{g}")]);
        let c = parse_command_line_with(&format!("msiexec /i {g} /qb"), &all_exist).unwrap();
        assert_eq!(
            c.args,
            vec!["/X".to_string(), g.to_string(), "/qb".to_string()]
        );
        let c = parse_command_line_with(&format!("MsiExec.exe /X{g}"), &all_exist).unwrap();
        assert_eq!(c.args, vec![format!("/X{g}")]);
        // A full path to msiexec is replaced by the system one.
        let c = parse_command_line_with(
            &format!(r#""C:\Windows\System32\msiexec.exe" /I{g}"#),
            &|_| false,
        )
        .unwrap();
        assert_eq!(c.program, Program::Msiexec);
    }

    #[test]
    fn rejects_bad_programs() {
        let none = |_: &str| false;
        for bad in [
            "",
            "   ",
            "\"\" /x",
            "uninstall.exe /x",
            r"..\evil.exe",
            r"C:\a\..\evil.exe",
            r"\\server\share\evil.exe",
            r"%ProgramFiles%\Acme\u.exe",
            r"C:\Acme\u.bat",
            r"C:\Acme\u.exe.txt /x",
            "cmd /c calc",
            "\"C:\\unterminated.exe /x",
        ] {
            assert!(parse_command_line_with(bad, &all_exist).is_err(), "{bad}");
        }
        // Absolute .exe that does not exist.
        assert!(parse_command_line_with(r"C:\Acme\u.exe", &none).is_err());
    }

    #[test]
    fn matches_install_location_and_parent() {
        let e = entry(
            "Acme Synth",
            Some(r"C:\Program Files\Acme\Synth\"),
            Some(r"C:\x\u.exe"),
        );
        assert!(entry_matches_plugin(
            &e,
            r"c:\program files\acme\synth\vst3\Synth.vst3"
        ));
        assert!(entry_matches_plugin(
            &e,
            r"C:/Program Files/Acme/Synth/Synth.dll"
        ));
        assert!(!entry_matches_plugin(
            &e,
            r"C:\Program Files\Acme\SynthTwo\x.dll"
        ));
        assert!(!entry_matches_plugin(&e, r"C:\Program Files\Other\x.dll"));
    }

    #[test]
    fn matches_uninstaller_folder() {
        let e = entry(
            "Acme",
            None,
            Some(r#""C:\Program Files\Common Files\VST3\Acme\unins000.exe" /x"#),
        );
        assert!(entry_matches_plugin(
            &e,
            r"C:\Program Files\Common Files\VST3\Acme\Acme.vst3"
        ));
        let mut icon = entry("Acme", None, Some(r"C:\a\b.exe"));
        icon.display_icon = Some(r#""C:\Acme Audio\app.exe",0"#.into());
        assert!(entry_matches_plugin(&icon, r"C:\Acme Audio\plugins\x.dll"));
    }

    #[test]
    fn generic_locations_never_match() {
        for loc in [
            r"C:\",
            r"C:\Program Files",
            r"C:\Program Files\Common Files\VST3",
            r"C:\Windows\System32",
            "",
        ] {
            let e = entry(
                "X",
                Some(loc),
                Some(r"C:\Windows\System32\msiexec.exe /X{1}"),
            );
            assert!(
                !entry_matches_plugin(&e, r"C:\Program Files\Common Files\VST3\A.vst3"),
                "{loc}"
            );
        }
        let msi = entry("X", None, Some("MsiExec.exe /I{1}"));
        assert!(!entry_matches_plugin(&msi, r"C:\Windows\System32\a.dll"));
    }

    #[test]
    fn skips_unusable_entries() {
        let p = r"C:\Acme\a.dll";
        assert!(!entry_matches_plugin(
            &entry("", Some(r"C:\Acme"), Some(r"C:\Acme\u.exe")),
            p
        ));
        assert!(!entry_matches_plugin(
            &entry("A", Some(r"C:\Acme"), None),
            p
        ));
        let mut sys = entry("A", Some(r"C:\Acme"), Some(r"C:\Acme\u.exe"));
        sys.system_component = true;
        assert!(!entry_matches_plugin(&sys, p));
    }

    #[test]
    fn longest_install_location_wins() {
        let entries = vec![
            entry(
                "Suite",
                Some(r"C:\Audio\Acme"),
                Some(r"C:\Audio\Acme\suite.exe"),
            ),
            entry(
                "Synth",
                Some(r"C:\Audio\Acme\Synth"),
                Some(r"C:\Audio\Acme\Synth\u.exe"),
            ),
        ];
        let sel = select_entries(&entries, r"C:\Audio\Acme\Synth\Synth.vst3");
        assert_eq!(sel[0].display_name, "Synth");
        assert_eq!(sel.len(), 2);
    }

    #[test]
    fn name_fallback_only_when_unique_and_exact() {
        let p = r"C:\Plugins Elsewhere\Cool Synth x64.dll";
        let one = vec![
            entry("Cool Synth", None, Some(r"C:\z\u.exe")),
            entry("Other", None, Some(r"C:\z\u.exe")),
        ];
        assert_eq!(select_entries(&one, p).len(), 1);
        let two = vec![
            entry("cool  synth", None, Some(r"C:\z\u.exe")),
            entry("Cool Synth", None, Some(r"C:\y\u.exe")),
        ];
        assert!(select_entries(&two, p).is_empty());
        let partial = vec![entry("Cool Synth Pro", None, Some(r"C:\z\u.exe"))];
        assert!(select_entries(&partial, p).is_empty());
        // Generic parent folder names are not used.
        let generic = vec![entry("VST3", None, Some(r"C:\z\u.exe"))];
        assert!(select_entries(&generic, r"C:\q\VST3\a.vst3").is_empty());
    }

    #[test]
    fn resolve_builds_preview_and_skips_unparsable() {
        let entries = vec![
            entry("Bad", Some(r"C:\Audio\Acme\Synth"), Some("rundll32 foo")),
            entry(
                "Good",
                Some(r"C:\Audio\Acme"),
                Some(r#""C:\Audio\Acme\u.exe" /S"#),
            ),
        ];
        let r = resolve_command(&entries, r"C:\Audio\Acme\Synth\a.dll", &all_exist).unwrap();
        assert_eq!(r.info.display_name, "Good");
        assert_eq!(r.info.kind, "exe");
        assert_eq!(r.info.source, "registry");
        assert_eq!(r.info.command_preview, r#""C:\Audio\Acme\u.exe" /S"#);
        assert!(resolve_command(&entries, r"D:\none\a.dll", &all_exist).is_none());
    }

    #[test]
    fn exit_codes() {
        for ok in [0, 3010, 1641] {
            assert_eq!(exit_result(Some(ok)), Ok(()));
        }
        assert_eq!(exit_result(Some(1)), Err("ERR_VENDOR_FAILED:1".into()));
        assert_eq!(exit_result(None), Err("ERR_VENDOR_FAILED:?".into()));
    }

    #[test]
    fn parses_pkgutil_output() {
        let out = "volume: /\npath: /Library/Audio/Plug-Ins/VST3/A.vst3\n\npkgid: com.acme.synth\npkg-version: 1.2\ninstall-time: 1700000000\nuid: 0\n\npkgid: com.acme.synth\n\npkgid: bad id;rm\n";
        assert_eq!(parse_pkgutil_file_info(out), vec!["com.acme.synth"]);
        assert!(parse_pkgutil_file_info("volume: /\npath: /x\n").is_empty());
    }

    #[test]
    fn serializes_camel_case() {
        let v = VendorUninstaller {
            display_name: "A".into(),
            publisher: None,
            kind: "exe".into(),
            command_preview: "c".into(),
            source: "registry".into(),
        };
        let j = serde_json::to_value(&v).unwrap();
        assert_eq!(j["displayName"], "A");
        assert_eq!(j["commandPreview"], "c");
        assert!(j["publisher"].is_null());
    }

    #[cfg(not(windows))]
    #[test]
    fn run_is_unsupported_off_windows() {
        assert_eq!(
            run_blocking(Path::new("/nonexistent/a.vst3")),
            Err("ERR_VENDOR_UNSUPPORTED".into())
        );
    }
}
