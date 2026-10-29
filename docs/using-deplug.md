# Using Deplug

::: info The interface language
The current build shows its interface in Italian. The English and Italian interface, with a language switch in Settings, is coming in 0.1.0. Button names in these docs use the English wording; "Move to trash" is "Sposta nel cestino" and "Cancel" is "Annulla" in the Italian UI.
:::

## What gets scanned

On startup, and whenever you press refresh, Deplug looks through the standard plugin folders of your system. It searches up to three folder levels deep, so vendor sub-folders are covered.

| System | Folders |
| --- | --- |
| Windows | `C:\Program Files\Common Files\VST2`, `C:\Program Files\Steinberg\VSTPlugins`, `C:\Program Files (x86)\Steinberg\VstPlugins`, `C:\Program Files\Common Files\VST3`, `C:\Program Files\Common Files\Avid\Audio\Plug-Ins` |
| macOS | `/Library/Audio/Plug-Ins/VST`, `.../VST3`, `.../Components`, `/Library/Application Support/Avid/Audio/Plug-Ins`, and the same `VST`, `VST3` and `Components` folders under `~/Library/Audio/Plug-Ins` |
| Linux | `/usr/lib/vst`, `/usr/local/lib/vst`, `~/.vst`, `/usr/lib/vst3`, `/usr/local/lib/vst3`, `~/.vst3` |

Anything you add as a [custom folder](/custom-folders) is scanned too, up to six levels deep.

## Formats

| Format | Recognised as | On |
| --- | --- | --- |
| VST2 | `.dll` / `.vst` / `.so` | Windows / macOS / Linux |
| VST3 | `.vst3` | all |
| AAX | `.aaxplugin` | all |
| AU (Audio Units) | `.component` | macOS only |

A plugin bundle (a folder such as `Something.vst3`) is listed as one plugin; Deplug does not look inside it.

## Filter by format

The four checkboxes in the toolbar (VST2, VST3, AAX, AU) show or hide the section of that format. Filtering only changes what you see; it does not rescan. Each section can also be collapsed on its own, and a format with no plugins has no section.

## Open a plugin's folder

Every row starts with a folder button. It opens the folder that contains the plugin in your file manager. Use it to check what is there before you uninstall.

## Uninstall a plugin

1. Press the trash button on the plugin's row. A confirmation dialog opens, with the plugin name and its full path.
2. On Windows, decide whether to create a restore point (next section).
3. Press **Move to trash**. The plugin goes to the system trash (Recycle Bin, Trash) and the list refreshes.

Nothing happens until you confirm, and **Cancel** (or Esc) closes the dialog without touching anything.

Deplug removes the plugin file or bundle only. It does not clean up presets, license files, samples or settings that the plugin's own installer put elsewhere. That is deliberate: those are often shared with other products or needed if you reinstall later.

To undo, open the trash and restore the item to its original location, then press refresh in Deplug.

## Restore point on Windows

On Windows the dialog has a checkbox, on by default: **Create a system restore point before uninstalling**. This is the same safety net Revo Uninstaller offers. If something goes wrong with your system after removing a plugin, you can roll back from Windows' System Restore.

Windows asks for administrator permission to create a restore point (a UAC prompt), because restore points are a system-level change. The checkbox is not shown on macOS and Linux.

### Why creating a restore point can fail

If it fails, Deplug shows the reason and asks whether to **continue without a restore point**. You choose: nothing is removed behind your back.

- **UAC was declined or cancelled.** The administrator prompt was closed or denied. Run the uninstall again and accept it.
- **System Protection is turned off.** Windows only creates restore points for drives where System Protection is on. Open "Create a restore point" in the Start menu, select your system drive, press **Configure** and turn protection on.
- **Windows created one in the last 24 hours.** By default Windows allows one automatically-created restore point per 24 hours. Deplug cannot override that. If you are removing several plugins, the first uninstall covers the rest of the day: continue without a new one.

Other errors show the message reported by Windows PowerShell.
