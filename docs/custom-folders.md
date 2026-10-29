# Custom folders

Many plugins are not installed by an installer. You download a ZIP, copy a `.vst3` or `.dll` into some folder (`D:\Audio\Plugins`, `~/Music/Plugins`, a project folder) and point your DAW at it. Those plugins are invisible to the standard-folder scan.

A **custom scan folder** tells Deplug to look there as well.

## Add a folder

1. Open **Settings** (the gear button in the toolbar) and go to **Scan**.
2. Under **Custom folders**, press **Add folder** and choose a folder in the system dialog.
3. Close the settings. Deplug rescans and the plugins found in the new folder appear in their format sections.

Remove a folder with the cross next to it. The folder itself and its files are never touched; Deplug just stops looking there.

## How custom folders are scanned

- Sub-folders are searched up to **six levels deep** by default, deeper than the three levels used for standard folders, because manually organised libraries are often nested. Change it with **Custom folder depth** in Settings, from 1 to 10. It applies to all custom folders.
- A plugin found by both a standard and a custom folder is listed once.
- A custom folder that no longer exists (for example an unplugged drive) is skipped without an error.
- The same format rules apply: `.vst3` and `.aaxplugin` everywhere, `.dll` on Windows, `.vst` and `.component` on macOS, `.so` on Linux.

## Where the list is saved

Your folders are stored in Deplug's `settings.json`, in the system profile for a normal install or in the data folder next to the app in [portable mode](/portable-mode). See [where data is stored](/faq#where-does-deplug-store-its-data).

## Uninstalling from a custom folder

Works exactly like any other plugin: confirmation, then the system trash. Deplug refuses paths that are not a plugin file or bundle, so a custom folder pointed at something large like your home folder cannot be wiped by mistake. See [Safety and privacy](/safety-and-privacy).
