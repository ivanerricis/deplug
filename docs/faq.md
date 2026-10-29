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
- Check the format filters in the toolbar: a format that is unticked is hidden.
- Formats depend on the system: `.component` (AU) is only scanned on macOS, VST2 is `.dll` on Windows, `.vst` on macOS and `.so` on Linux.
- Press the refresh button after installing or moving plugins.
- If a folder needs special permissions, Deplug skips what it cannot read, without an error. On macOS, check that Deplug is allowed to access that location in **Privacy & Security**.

## A plugin is in use or cannot be removed

If your DAW (or a plugin host) has the plugin loaded, the operating system may keep the file locked, and moving it to the trash fails. Close the DAW and any plugin scanner, then try again. Deplug shows the error from the system.

Folders such as `C:\Program Files` can also need administrator rights. If removal is refused for that reason, start Deplug as administrator, or delete that one file from the file manager.

## The restore point failed

See [Restore point on Windows](/using-deplug#why-creating-a-restore-point-can-fail): UAC declined, System Protection off, or the 24-hour limit.

## Does uninstalling remove presets and license files?

No. Deplug removes only the plugin file or bundle you selected. See [Using Deplug](/using-deplug#uninstall-a-plugin).

## Where does Deplug store its data?

Only one file: `settings.json`, which holds the custom scan folders (and, from 0.1.0, your preferences).

| Mode | Location |
| --- | --- |
| Installed, Windows | `%APPDATA%\com.ivane.deplug\settings.json` |
| Installed, macOS | `~/Library/Application Support/com.ivane.deplug/settings.json` |
| Installed, Linux | `~/.config/com.ivane.deplug/settings.json` |
| [Portable](/portable-mode) | `Deplug-data/settings.json` next to the app |

`com.ivane.deplug` is the application's identifier folder. Delete the file to reset to defaults. The plugin list itself is never stored; it is rebuilt on every scan.

## Is anything sent over the network?

No. See [Safety and privacy](/safety-and-privacy).

## Where do I report a bug?

Open an issue on [GitHub](https://github.com/ivanerricis/deplug/issues) with your system, the Deplug version and what you did.
