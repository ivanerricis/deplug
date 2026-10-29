# Plugin Uninstaller

Desktop app (Tauri + React + TypeScript) that scans the standard install
folders for audio plugins (VST2, VST3, AAX) on Windows, macOS and Linux,
lists them by format and lets you open their folder.

## Development

```bash
npm ci
npm run dev        # frontend only
npm run tauri dev  # full app
npm run typecheck
npm test
```

Requires Node 24+ and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Portable

Each release also ships portable builds next to the installers. They need no installation and keep all data in a `PluginUninstaller-data/` folder next to the app. Portable mode is enabled by the `portable.txt` marker file placed beside the executable; delete it to go back to normal (system profile) storage.

- **Windows**: unzip `Plugin-Uninstaller_<version>_x64_portable.zip` anywhere (a USB stick included) and run `plugin-uninstaller.exe`.
- **Linux**: extract `Plugin-Uninstaller_<version>_amd64_portable.tar.gz` and run the `.AppImage` (already executable). AppImages need `libfuse2`; without it run `./Plugin*.AppImage --appimage-extract-and-run`.
- **macOS**: unzip `Plugin-Uninstaller_<version>_universal_portable.zip` and keep `Plugin Uninstaller.app` and `portable.txt` in the same folder. The app is not notarized, so remove the quarantine flag: `xattr -dr com.apple.quarantine "Plugin Uninstaller.app"`. Otherwise App Translocation runs the app from a random read-only location and the portable marker is not found.

Some traces can still be left outside the data folder: WebView2 crash dumps on Windows and the system WebKit caches/storage on macOS.

## License

Copyright (c) 2026 Ivan Erricis. All rights reserved. See [LICENSE](LICENSE).
