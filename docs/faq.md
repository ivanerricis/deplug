# FAQ and troubleshooting

## Windows says the app is from an unknown publisher

Deplug's builds are not code-signed, because certificates cost money and this is an independent project. Windows SmartScreen therefore shows "Windows protected your PC".

Choose **More info**, then **Run anyway**. Download only from the [official Releases page](https://github.com/ivanerricis/deplug/releases).

## macOS says the app is damaged or cannot be opened

The same reason: the app is not signed or notarized by Apple, so Gatekeeper blocks it, sometimes with a misleading "is damaged" message.

1. Move the app to **Applications**.
2. Right-click it, choose **Open**, then confirm; or
3. remove the quarantine flag in Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Deplug.app"
```

You can also allow it in **System Settings, Privacy & Security** right after a blocked launch.

## Nothing was found

- Deplug only looks in the [standard folders](/using-deplug#what-gets-scanned). If your plugins live somewhere else, add [a custom folder](/custom-folders).
- Check the format filters, the search field and **Show only duplicates** in the toolbar: anything filtered out is hidden.
- Check **Settings, Scan**: a standard folder you unticked, or **Scan on startup** being off, also means an empty list.
- Formats depend on the system: `.component` (AU) is only scanned on macOS, VST2 is `.dll` on Windows, `.vst` on macOS and `.so` on Linux.
- Press the rescan button after installing or moving plugins.
- If a folder needs special permissions, Deplug skips what it cannot read, without an error. On macOS, check that Deplug is allowed to access that location in **Privacy & Security**.

## A plugin is in use or cannot be removed

If your DAW (or a plugin host) has the plugin loaded, the operating system may keep the file locked, and moving it to the trash fails. Close the DAW and any plugin scanner, then try again. Deplug shows the error from the system.

Folders such as `C:\Program Files` can also need administrator rights. If removal is refused for that reason, start Deplug as administrator, or delete that one file from the file manager.

## Can I force the removal of a plugin that will not go away?

Yes. When a removal fails, or the publisher's uninstaller leaves the plugin behind, the result dialog shows **Force removal** for that plugin. After a second confirmation with the exact path, Deplug deletes it permanently (it does not go to the trash, and restore points do not cover it), asking for administrator permission on Windows if needed. If another program holds the file open, close it first; the error from the system is shown if the deletion still fails.

## Uninstall fails with "administrator permission is needed"

Plugins in protected folders such as `C:\Program Files\Common Files\VST2`, `VST3` or `Avid` can only be changed with administrator rights, and Deplug normally runs without them, so Windows denies the move to the Recycle Bin. When this happens the results list shows a notice and a **Retry with administrator permission** button. Press it and approve the single Windows permission prompt (UAC): all the plugins that were denied are retried together. The files still go to the Recycle Bin, so you can restore them. If you cancel the prompt nothing changes and you can press the button again.

If you would rather not be asked each time, there are two options: use the retry button when it appears, or turn on **Always run Deplug as administrator** in Settings > Uninstall, so Deplug starts with administrator rights from then on. If it already runs as administrator and the move is still denied, something else is blocking the file, for example another program using it.

## The restore point failed

See [Restore point on Windows](/using-deplug#why-creating-a-restore-point-can-fail): UAC declined, System Protection off, or the 24-hour limit.

## Does uninstalling remove presets and license files?

No. Deplug removes only the plugin file or bundle you selected. See [Using Deplug](/using-deplug#uninstall-a-plugin).

## Where does Deplug store its data?

Only one file: `settings.json`. It holds your preferences (language, theme, scan options, restore point default) and the custom scan folders.

| Mode | Location |
| --- | --- |
| Installed, Windows | `%APPDATA%\com.ivane.deplug\settings.json` |
| Installed, macOS | `~/Library/Application Support/com.ivane.deplug/settings.json` |
| Installed, Linux | `~/.config/com.ivane.deplug/settings.json` |
| [Portable](/portable-mode) | `Deplug-data/settings.json` next to the app |

`com.ivane.deplug` is the application's identifier folder. Delete the file (with Deplug closed) to reset to defaults; it is created again on the next change. The file is plain JSON, with keys such as `language`, `theme`, `scanOnStartup`, `customScanDepth`, `customScanPaths`, `disabledSystemPaths` and `restorePointDefault`, but the Settings dialog is the intended way to change them. The plugin list itself is never stored; it is rebuilt on every scan.

## Is anything sent over the network?

Only when you ask for it: **Settings → About → Check for updates** contacts the GitHub releases API (`api.github.com`) to read the list of published versions. If an update exists and you press **Download and install**, Deplug downloads the signed update from GitHub. Nothing else is sent, and nothing runs on its own. Your plugin list, paths and settings stay on your computer. See [Safety and privacy](/safety-and-privacy).

## Where do I report a bug?

Open an issue on [GitHub](https://github.com/ivanerricis/deplug/issues) with your system, the Deplug version and what you did.
