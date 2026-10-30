# Getting started

Deplug is a desktop app for Windows, macOS and Linux. It does not need an account or an internet connection.

## Download

Get the latest build from the [Releases page](https://github.com/ivanerricis/deplug/releases). Each release lists installers and portable builds as assets. File names contain the app name, the version and the architecture.

| System | Installer | Portable |
| --- | --- | --- |
| Windows | `.msi` or `.exe` | `Deplug_<version>_*_portable.zip` |
| macOS | `.dmg` (universal: Apple silicon and Intel) | `Deplug_<version>_*_portable.zip` |
| Linux | `.deb`, `.rpm` or `.AppImage` | `Deplug_<version>_*_portable.tar.gz` |

Releases whose tag ends in `-rc.N` (for example `v0.1.0-rc.1`) are release candidates and are marked as pre-releases. Use a plain `vX.Y.Z` release unless you want to test.

::: warning Builds are not code-signed
Windows SmartScreen and macOS Gatekeeper will warn you the first time you open Deplug. This is expected and is explained in the [FAQ](/faq#windows-says-the-app-is-from-an-unknown-publisher).
:::

## Install

### Windows

Run the `.msi` (or the `.exe` setup) and follow the wizard. If SmartScreen shows "Windows protected your PC", choose **More info**, then **Run anyway**.

### macOS

Open the `.dmg` and drag Deplug to **Applications**. On first launch macOS may refuse to open it. Right-click the app, choose **Open**, then confirm. If it still refuses, see the [FAQ](/faq#macos-says-the-app-is-damaged-or-cannot-be-opened).

### Linux

- Debian and Ubuntu: `sudo apt install ./deplug_*.deb`
- Fedora and openSUSE: `sudo dnf install ./deplug-*.rpm`
- Any distribution: make the `.AppImage` executable and run it. AppImages need `libfuse2`; see [Portable mode](/portable-mode#linux).

Prefer not to install anything? Use the [portable build](/portable-mode).

## Your first scan

1. Start Deplug. It scans the standard plugin folders automatically and shows a spinner until it is done.
2. The toolbar shows **how many plugins were found** and format tabs: All, VST2, VST3, AAX, AU and CLAP.
3. Plugins are listed in one collapsible section per format. Expand a section to see its plugins.
4. Search by name with the field in the toolbar (Ctrl+F or Cmd+F), and use the rescan button after you install or remove something outside Deplug.

If the list is empty or a plugin you expect is missing, read [Nothing was found](/faq#nothing-was-found) or add [a custom folder](/custom-folders).

Next: [Using Deplug](/using-deplug).
