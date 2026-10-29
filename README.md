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

Requires Node 20+ and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).
