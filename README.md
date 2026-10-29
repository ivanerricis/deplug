<p align="center">
  <img src="assets/brand/deplug-mark-color.svg" alt="Deplug logo" width="96" height="96">
</p>

<h1 align="center">Deplug</h1>

<p align="center">
  Find your installed audio plugins and uninstall them cleanly, to the system trash.
</p>

<p align="center">
  <a href="https://ivanerricis.github.io/deplug/">Documentation</a> ·
  <a href="https://github.com/ivanerricis/deplug/releases">Releases</a>
</p>

## Features

- Finds VST2, VST3, AAX and AU plugins in the standard folders on Windows, macOS and Linux, grouped by format, with per-format filters.
- Search by name or path (Ctrl/Cmd+F) and sortable columns.
- Flags duplicates (the same plugin in several formats or folders) and can show only those.
- Opens a plugin's folder in your file manager.
- Uninstalls by moving the plugin to the system trash, after an explicit confirmation. Paths are validated before anything is moved.
- Multi-select (Shift+click for ranges) to uninstall many plugins at once, with a per-plugin result.
- On Windows, can create a System Restore point first (like Revo Uninstaller), one for the whole batch.
- Custom scan folders (with adjustable depth) for plugins you copied by hand instead of installing, and the option to switch off built-in folders.
- Portable mode: put a `portable.txt` marker next to the app and all its data stays beside it.
- English and Italian interface, with light, dark or system theme, a settings dialog and an About section with copyable diagnostics.
- Nothing leaves your machine: no account, no telemetry.

## Install

Download the latest build from the [Releases page](https://github.com/ivanerricis/deplug/releases).

| System | Installer | Portable (no install) |
| --- | --- | --- |
| Windows | `.msi` / `.exe` | `Deplug_<version>_*_portable.zip` |
| macOS | `.dmg` (universal) | `Deplug_<version>_*_portable.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` | `Deplug_<version>_*_portable.tar.gz` |

Builds are not code-signed, so Windows SmartScreen and macOS Gatekeeper warn on first launch. The [FAQ](https://ivanerricis.github.io/deplug/faq) explains how to open them. Per-OS portable notes (AppImage and `libfuse2`, macOS quarantine) are in the [portable mode guide](https://ivanerricis.github.io/deplug/portable-mode).

## Quick start

1. Start Deplug. It scans the standard plugin folders on launch.
2. Search, sort, or use the VST2 / VST3 / AAX / AU checkboxes and **Show only duplicates** to filter. The folder button opens a plugin's location.
3. Press the trash button on a plugin, or select several and press **Uninstall selected**. Confirm (and on Windows choose whether to create a restore point), and the plugins move to the system trash.
4. Plugins in other places? Add the folder as a custom scan folder in Settings, Scan.

Full guide: <https://ivanerricis.github.io/deplug/>. An Italian version is at <https://ivanerricis.github.io/deplug/it/>.

## Development

Requires Node 24+, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm ci
npm run dev         # frontend only, in the browser
npm run tauri dev   # full desktop app
npm run typecheck
npm test
npm run build       # typecheck + production frontend build
```

The documentation site lives in `docs/` and has its own `package.json`; see [docs/README.md](docs/README.md).

## Project layout

| Path | Contents |
| --- | --- |
| `src/` | React + TypeScript front end (components, scanner, uninstall flow, settings client) |
| `src-tauri/` | Rust back end: trash, restore points, settings, portable mode |
| `src-tauri/portable-core/` | Small Rust crate with the portable-mode and settings logic, tested on its own |
| `packaging/` | `portable.txt` marker and release helper scripts |
| `assets/brand/` | Logo and brand assets (see its README) |
| `docs/` | VitePress documentation site (English and Italian) |
| `.github/workflows/` | CI, release and docs deployment |

## CI and releases

- `ci.yml` runs on pull requests and on `main`: typecheck, tests, front end build, Clippy on Linux, Windows and macOS, and the `portable-core` tests.
- Pushing a tag `vX.Y.Z` runs `release.yml`, which builds installers and portable packages for all three systems and attaches them to a **draft** release. Tags with a suffix such as `v0.1.0-rc.1` create a pre-release.
- The versions in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` must match the tag, otherwise the release fails at the first step.
- `docs.yml` publishes the documentation to GitHub Pages when `docs/**` changes on `main`.

## License

Copyright (c) 2026 Ivan Erricis. All rights reserved. See [LICENSE](LICENSE).
