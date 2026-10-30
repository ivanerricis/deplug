# Changelog

All notable changes to Deplug are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).
The release workflow publishes the section of the released version as the release notes, so add each
change under **Unreleased** in the pull request that makes it, and rename that heading to the version
when releasing.

## [Unreleased]

### Fixed
- Closing a dialog or menu no longer pops up the tooltip of the button that opened it (all tooltips ignore focus that returns by script; keyboard focus still shows them).
- The selected option of the **Group by** switch is now clearly highlighted (the tooltip was hiding its selected state).

### Added
- `CLAUDE.md` and project skills for contributors and agents (checks, release, new setting, new format, UI screenshots, sub-agent brief).
- Group by producer: a Format | Producer switch next to the format tabs lists plugins by producer, with select-all, plugin count, total size, collapsing and sorting of the producers (name, number of plugins, size). The producer comes from the plugin's own metadata (VST3 `moduleinfo.json`, the company name in Windows plugin files, the macOS bundle identifier) and then from the Windows installed-programs list; plugins without one are listed as Unknown.
- The CSV export has a `vendor` column.
- The chosen grouping and producer order are remembered with the tab and sort.

### Changed
- The welcome screen puts the scan first: a large, focused "Scan for plugins" button (Enter starts it), a note that scanning only reads folders, and how many folders will be searched, with a link to choose them.
- The logo is no longer shown in the toolbar; the window title bar already names the app.
- The settings dialog is wider and its rows give hints the full width instead of squeezing them next to the controls; related settings are grouped under small headings, and several hints are shorter.
- **Search the registry for leftovers** (Windows) and **Check for updates at startup** are now on by default; both can be turned off in Settings. The registry search still only offers keys (none selected, backed up to a `.reg` file before deletion), and the update check makes one request to GitHub's public releases list at most every 24 hours.
- The settings dialog is taller on large windows.

## [0.1.0] - 2026-10-30

First public release.

### Added
- Finds VST2, VST3, AAX, AU and CLAP plugins in the standard folders of Windows, macOS and Linux and in folders you add; 32-bit and 64-bit plugins are told apart.
- Format tabs (All, VST2, VST3, AAX, AU, CLAP) with search, sorting, duplicate detection, architecture filter, damaged-plugin filter and multi-select.
- Safe uninstall: plugins go to the system trash, with an optional Windows restore point first.
- The publisher's own uninstaller is offered when Windows lists one, also for several plugins at once.
- Leftover folders, and optionally leftover registry keys (Windows, backed up to a `.reg` file first), are offered after an uninstall; nothing is selected by default.
- Retry with administrator rights when a protected folder refuses the removal; Deplug can also always run as administrator (Windows, on by default).
- Optional permanent deletion, forced removal for plugins that cannot be removed, and the space freed after an uninstall.
- Export the list as CSV or plain text.
- Settings: language (English, Italian), theme, scan folders, scan exclusions, depth, columns and density, remembered tab and sort, delete method, confirmation, update options.
- Portable mode: a `portable.txt` next to the program keeps all data in a `Deplug-data` folder.
- Checks for updates (manually or at startup) and installs signed updates from inside the app on installed copies.
- Keyboard shortcuts, a welcome screen and clearer empty states.
- Installers for Windows (per-machine), macOS and Linux, plus portable builds.

[Unreleased]: https://github.com/ivanerricis/deplug/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ivanerricis/deplug/releases/tag/v0.1.0
