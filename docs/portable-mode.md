# Portable mode

Portable mode lets Deplug run without being installed and keep its data next to the app, for example on a USB stick.

It is switched on by a marker file named `portable.txt` placed beside the executable. Every portable download already contains it. Delete the file to go back to normal storage in the system profile.

When portable mode is active:

- settings are saved in a `PluginUninstaller-data` folder next to the app;
- the app redirects its web view data and caches into that folder where the platform allows it;
- the settings panel shows "Portable mode" and the data folder path.

If the folder next to the app is not writable (a read-only disk, a protected location), Deplug falls back to normal storage and shows a warning.

## Windows

1. Download `*_portable.zip` from [Releases](https://github.com/ivanerricis/deplug/releases).
2. Unzip it anywhere, including a USB stick.
3. Run the `.exe` inside. `portable.txt` must stay in the same folder.

## Linux {#linux}

1. Download `*_portable.tar.gz` and extract it. The folder contains an `.AppImage` (already executable) and `portable.txt`.
2. Run the `.AppImage`.

AppImages need **FUSE 2**. If it does not start, install `libfuse2` (on Ubuntu 24.04 the package is `libfuse2t64`), or run it without FUSE:

```bash
./Deplug*.AppImage --appimage-extract-and-run
```

## macOS

1. Download `*_portable.zip` and unzip it. Keep the app and `portable.txt` in the same folder.
2. The app is not notarized, so remove the quarantine flag once:

```bash
xattr -dr com.apple.quarantine "Deplug.app"
```

Without this step macOS runs the app through **App Translocation**: it copies it to a random read-only location, where `portable.txt` cannot be found, so Deplug silently starts in normal mode and shows a warning.

## What still leaves traces

Portable mode keeps Deplug's own data in one place, but it cannot control the operating system:

- **Windows:** WebView2 may still write crash dumps outside the data folder.
- **macOS:** the system WebKit caches and storage live in your user library.
- **All systems:** files moved to the trash stay in the system trash until you empty it, and on Windows a restore point is stored by the system, not by the app.
- On Windows and macOS the window position and size are not remembered in portable mode, because that would write outside the data folder.
