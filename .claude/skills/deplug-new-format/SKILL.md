---
name: deplug-new-format
description: The places to touch when Deplug learns a new plugin format (as was done for CLAP): types, scanner, default folders, tabs, colors, settings tab list, backend validation, docs. Use when adding or changing a supported plugin format.
---

# Adding a plugin format

Start with `grep -rn "AAX" src src-tauri/src docs README.md` and walk every hit. The known touch points:

- **Types and scanner**: `PluginType` in `src/core/plugin/Plugin.ts`; `pluginTypeOf`, `ScanResult` (`{all, vst2, vst3, aax, au, clap}`)
  in `src/core/plugin/PluginScanner.ts`. A format may be a file on one OS and a directory bundle on another: report
  the bundle without descending into it.
- **Default folders** per OS in `src/core/plugin/Path.ts` (Windows folders derive from `system_paths` env values,
  `src-tauri/src/syspaths.rs`) with tests in `Path.test.ts`.
- **Lists and filters**: `ListOps.ts` (duplicate name normalization strips the extension), `Export.ts`, `emptyState.ts`,
  `diagnostics.ts`.
- **UI**: format tabs and counts in `Toolbar.tsx`, `SectionType`/`SECTION_ORDER` and the per-format state records in
  `App.tsx`, `Section.tsx`, `FormatTag.tsx`; a distinct `--fmt-<name>` color token plus its `@theme` mapping in
  `src/index.css` for light and dark (contrast about 5:1 against its 12% tint). Check the toolbar still fits one row
  at 900 px.
- **Settings**: `TAB_SETTINGS` in `AppSettings.ts` and the `TABS` list in `portable-core` so `defaultTab`/`lastTab`
  accept it.
- **Backend**: `validate_plugin_path` in `src-tauri/src/uninstall.rs` (allowed extensions), generic/protected folder
  names in `vendor.rs` (`GENERIC_DIR_NAMES`, keep the array length right) and `leftovers.rs`; `meta.rs` ignores the
  extension for architecture and health, add tests for the file and bundle shapes.
- **Docs and text**: formats and default-folders tables in `docs/using-deplug.md` + IT, getting-started and index
  pages, README feature list, `tauri.conf.json` descriptions, welcome screen text, `CHANGELOG.md`.

Verify with the `deplug-checks` skill and a mocked-backend screenshot (`deplug-ui-screenshots`).
