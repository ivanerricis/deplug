# Changelog

All notable changes to Deplug are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).
The release workflow publishes the section of the released version as the release notes, so add each
change under **Unreleased** in the pull request that makes it, and rename that heading to the version
when releasing.

## [Unreleased]

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
