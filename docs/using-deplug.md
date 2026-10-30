# Using Deplug

## First start

The first time you open Deplug it shows a welcome screen instead of scanning right away, even if **Scan on startup** is on. Press **Scan for plugins** to run the first scan, or **Scan settings** to add folders first. From then on Deplug follows your [Settings](/settings#scan). If you update from an older version, the welcome screen is skipped.

## What gets scanned

On startup (unless you turned that off in [Settings](/settings#scan)), and whenever you press the rescan button, Deplug looks through the standard plugin folders of your system. It searches up to three folder levels deep, so vendor sub-folders are covered.

| System | Folders |
| --- | --- |
| Windows | VST2: `Program Files\VstPlugins`, `Program Files (x86)\VstPlugins`, `Common Files\VST2` (both), `Program Files\Steinberg\VSTPlugins`, `Program Files (x86)\Steinberg\VstPlugins`. VST3: `Common Files\VST3` (both), `%LOCALAPPDATA%\Programs\Common\VST3`. AAX: `Common Files\Avid\Audio\Plug-Ins` (both). CLAP: `Common Files\CLAP` (both), `%LOCALAPPDATA%\Programs\Common\CLAP`. See below. |
| macOS | `/Library/Audio/Plug-Ins/VST`, `.../VST3`, `.../CLAP`, `.../Components`, `/Library/Application Support/Avid/Audio/Plug-Ins`, and the same `VST`, `VST3`, `CLAP` and `Components` folders under `~/Library/Audio/Plug-Ins` plus `~/Library/Application Support/Avid/Audio/Plug-Ins` |
| Linux | `/usr/lib/vst`, `/usr/local/lib/vst`, `~/.vst`, `/usr/lib/vst3`, `/usr/local/lib/vst3`, `~/.vst3`, `/usr/lib/clap`, `~/.clap` |

On Windows the roots are read from the system (the `ProgramFiles`, `ProgramFiles(x86)`, `CommonProgramFiles` and `CommonProgramFiles(x86)` locations), so a relocated or localised Program Files works. "Both" means the 64-bit and the 32-bit (`Program Files (x86)`) variant of the folder.

Anything you add as a [custom folder](/custom-folders) is scanned too, by default up to six levels deep (you can change this between 1 and 10 in [Settings](/settings#scan)). You can also switch off individual standard folders there.

## Formats

| Format | Recognised as | On |
| --- | --- | --- |
| VST2 | `.dll` / `.vst` / `.so` | Windows / macOS / Linux |
| VST3 | `.vst3` | all |
| AAX | `.aaxplugin` | all |
| AU (Audio Units) | `.component` | macOS only |
| CLAP | `.clap` | all |

A plugin bundle (a folder such as `Something.vst3`, or a `.clap` on macOS) is listed as one plugin; Deplug does not look inside it.

## AAX, 32-bit and 64-bit

**AAX** (Pro Tools) plugins are `.aaxplugin` bundles and get a section of their own that works like the others: sorting, selection, duplicates and uninstall. On Windows they live in `Common Files\Avid\Audio\Plug-Ins`, on macOS in `/Library/Application Support/Avid/Audio/Plug-Ins` and the same folder under your home. AU is macOS only.

Deplug reads the architecture of each plugin file. Next to the name you may see a small pill:

- **32-bit** (amber): the plugin will not load in a 64-bit DAW without a bridge. Typical for plugins under `Program Files (x86)`.
- **ARM64**, **Universal** (Intel and ARM) and **Mixed** (a bundle holding different architectures), in muted grey.
- Plain 64-bit plugins, the norm, show no pill, and neither do plugins whose architecture could not be determined.

The **Architecture** menu in the toolbar (All, 64-bit, 32-bit, ARM64) narrows the list to one architecture. It works together with search, the format checkboxes and the duplicates filter, and its counts follow them. Plugins of unknown architecture are hidden while a specific architecture is chosen. The menu appears once at least one architecture is known. The architecture is also shown in the uninstall dialog and in the copied diagnostics.

## Filter by format

The tabs in the toolbar (All, VST2, VST3, AAX, AU, CLAP) show every format together or just one, each with its plugin count. Filtering only changes what you see; it does not rescan. Each section can also be collapsed on its own, and a format with no plugins has no section. If the selected format has no plugins at all, Deplug says so (for example "No AU plugins") and offers **Switch to All**. If your search or filters hide everything, it shows "Nothing matches" with **Clear filters** instead.

## Group by producer {#group-by-producer}

The **Group by** switch next to the format tabs (**Format** | **Producer**; icons only in a narrow window, with tooltips) changes how the list is organised. In **Producer** mode there is one section per producer (FabFilter, Native Instruments, ...) instead of one per format. The format tabs stay and act as a filter: **All** shows everything, **VST3** only the VST3 plugins of each producer. Because formats are mixed, every row shows its format.

Each producer section shows how many plugins it holds and their total size, can be collapsed, and has its own checkbox that selects every plugin of that producer among the ones currently shown (it shows a partial state when only some are selected). The column headers inside a section sort its plugins as usual. A **Sort producers** menu above the list orders the sections by **Name**, **Number of plugins** or **Size**, with a button to reverse the direction.

Where the producer name comes from, in this order:

1. The plugin's own metadata: the vendor in a VST3 bundle's `moduleinfo.json`, or the company name stored in the version information of a Windows plugin file.
2. On macOS, the identifier of the bundle (for example `com.fabfilter.proq3` gives *fabfilter*), when the bundle has no better information.
3. On Windows, the publisher of the matching entry in the installed programs list.

Names are compared without regard to case, punctuation and trailing company words, so "FabFilter", "FABFILTER" and "FabFilter Software Instruments" end up in one section, shown with the spelling most plugins use. Plugins for which none of these sources has a name are listed in an **Unknown** section at the end. While Deplug is still reading file details after a scan, plugins appear in **Unknown** (marked *reading...*) and move to their producer once it is known. The producer is also included as a `vendor` column in the CSV export. Deplug only reads these small pieces of information from the files; it never loads or runs a plugin. The grouping and the producer order are remembered with the tab and sort.

## Search

The search field in the toolbar filters the list as you type. It matches the plugin name or its path, ignoring case and accents. Press **Ctrl+F** (**Cmd+F** on macOS) to jump to it from anywhere in the window. **Esc** clears the search; use the cross inside the field for the same. If nothing matches, a **Clear filters** button resets the search, the duplicates, damaged, architecture and format filters in one go.

## Export the list

The download button in the toolbar saves the plugin list to a file. It exports what you currently see in the active tab, after search, duplicates and architecture filters. If some plugins are selected, only the selection is exported; the menu says which of the two applies and how many plugins. Choose **CSV** for a spreadsheet (columns: format, name, path, size in bytes, modified date in ISO 8601, architecture, vendor; UTF-8, opens correctly in Excel) or **plain text** for one full path per line. A save dialog proposes `deplug-plugins-YYYY-MM-DD` and a message confirms where the file went, or why it failed. Size, date, architecture and vendor stay empty for plugins whose details were not read yet.

## Sorting

Each section has column headers (**Name**, plus **Path**, **Size** and **Modified** when those columns are shown; see [Settings](/settings#general)). Click one to sort by it, click it again to reverse the order. The tab and sort you used last are remembered for the next start (or set a fixed start in the settings). Sorting is natural, so "Plug 2" comes before "Plug 10", and every format section keeps its own order.

## Duplicates

A plugin that appears more than once gets a **Duplicate** badge. Two entries count as the same plugin when their names match after removing the extension and a trailing `x64`, ignoring case. That catches the same plugin in several formats (VST2 and VST3), in several folders, or both. Hover the badge to see where the other copies are.

The **Show only duplicates** checkbox in the toolbar keeps only those plugins and shows how many there are. It is a good starting point for a clean-up. Deplug only points them out; deciding which copy to keep is up to you.

## Damaged plugins

A plugin that cannot load gets a **Damaged** badge. Deplug flags a zero-byte plugin file, an empty plugin folder, and a bundle (`.vst3`, `.aaxplugin`, `.component`, `.vst`) whose binary inside `Contents` is missing or zero size. Hover the badge for the reason. Only file sizes are checked, never file contents.

The **Show only damaged plugins** checkbox in the toolbar keeps only those plugins and shows how many there are. They can be selected and uninstalled like any other plugin.

## Select several plugins

Every row has a checkbox in its first column.

- Click a checkbox to select a plugin. Press **Space** on a focused checkbox for the same.
- **Shift+click** a second checkbox to select (or deselect) the whole range between the two, within one section.
- The checkbox in a section header selects every plugin currently shown in that section. Hidden plugins (filtered out by search, format or duplicates) are never selected.
- **Esc** clears the selection.

While something is selected, a bar at the bottom shows "N selected" with **Uninstall selected** and **Clear**.

## Open a plugin's folder

Every row starts with a folder button. It opens the folder that contains the plugin in your file manager. Use it to check what is there before you uninstall.

## Uninstall a plugin

1. Press the trash button on the plugin's row, or select several plugins and press **Uninstall selected**. A confirmation dialog opens, with the plugin name (or the list of plugins).
2. On Windows, decide whether to create a restore point (next section).
3. Press **Move to trash**. The plugins go to the system trash (Recycle Bin, Trash) and the list refreshes.

Nothing happens until you confirm, and **Cancel** (or Esc) closes the dialog without touching anything. If you turned off **Ask for confirmation before uninstalling** in [Settings](/settings#uninstall), choosing Uninstall runs right away with your saved defaults (restore point, delete method) and goes straight to the result dialog; the publisher's uninstaller and leftover folders are never chosen automatically. Deplug always asks first when the delete method is **Delete permanently**.

Deplug removes the plugin file or bundle only. It does not clean up presets, license files, samples or settings that the plugin's own installer put elsewhere. That is deliberate: those are often shared with other products or needed if you reinstall later.

### Uninstalling a batch

With several plugins, Deplug creates **one** restore point for the whole batch, then moves the plugins to the trash one after another. A failure on one plugin does not stop the others. When it finishes, the dialog lists the result for each plugin (**Moved to the trash** or **Failed**, with the reason), failed ones first. Close it and the list refreshes.

To undo, open the trash and restore the item to its original location, then press refresh in Deplug.

### Delete permanently

By default plugins go to the trash. If you set **Delete method** to **Delete permanently** in [Settings](/settings#uninstall), the files skip the trash and are removed for good. The confirmation text says so: they cannot be recovered, and a system restore point does not cover them. Leftover folders you tick follow the same choice. On Windows, if a protected folder denies the deletion, the same **Retry with administrator permission** button appears and the deletion is retried from an elevated process.

### Space freed and sizes per format

After an uninstall, the result dialog shows **Space freed**: the total size of the plugins that were removed, using the sizes already shown in the list. If some sizes are unknown it says "at least"; if none is known the line is not shown. Next to the count in each format's header the list shows the total size of the plugins displayed in that format.

### Force removal

If a plugin could not be removed, or the publisher's uninstaller finished but left it in place, the result dialog offers a **Force removal** button for that plugin. It opens an extra confirmation that shows the exact path, because it deletes the plugin permanently (no trash, no restore point coverage). On Windows, if the deletion is denied, Deplug retries it once from an elevated process after a single permission prompt. If the file is locked or in use, the error from the system is shown in the result.

### The publisher's uninstaller and leftover folders

When you uninstall a **single** plugin, Deplug also looks in the background for two optional extras. If it finds nothing (or the check fails, or you are on Linux) the dialog looks exactly as before. Leftover folders are only offered for a single plugin; the publisher's uninstaller is also offered in batches (see below).

- **The publisher's own uninstaller.** If the plugin was installed by a regular installer, the dialog says so and lets you choose between **Move only the files to the trash** (the default) and **Run the publisher's uninstaller**. The second choice shows the exact command first, and the confirm button becomes **Run uninstaller**. It starts a program from the publisher, which may ask for administrator permission and may remove more than this plugin; Deplug waits for it to finish. On macOS, if the plugin came from an installer package, the dialog only shows the package id: Deplug cannot run those, so the files are moved to the trash.
- **Leftover folders.** A collapsed **Leftover folders** section lists data folders the publisher may have left behind (presets, licenses, settings), with their size. **None is selected by default.** Tick the ones you want gone; they are moved to the trash before the plugin is removed. Be careful: they can hold presets or licenses you still need.

If something fails, the dialog ends with a summary of what was done and what was not. If the publisher's uninstaller finishes but the plugin is still there, Deplug tells you and leaves it alone.

**In a batch.** Deplug looks up the publisher's uninstaller for each selected plugin. Plugins that resolve to the same uninstaller are grouped, and each group is offered once, for example **Run the publisher's uninstaller for Voxengo SPAN (3 selected plugins)**, with the exact command shown once you tick it. By default nothing is ticked and everything is moved to the trash as before. For each ticked group Deplug runs that uninstaller once, one group after another, and waits for it to finish. The plugins in the group are then checked: a plugin is reported as removed only if it is gone, otherwise it is listed as **Still present** and left alone. If the uninstaller fails, every plugin of its group is reported as failed. Plugins you did not tick are moved to the trash.

#### Registry entries (Windows) {#registry-entries}

Unless you turn off **Search the registry for leftovers** in [Settings](/settings#uninstall) (it is on by default), a single-plugin uninstall also checks the registry, the way Revo Uninstaller does: **after** the plugin has been removed. When the dialog opens, Deplug only notes the plugin's publisher and product name; nothing is searched or changed yet. Once the plugin is gone, the result view looks for registry keys it left behind and shows them in a **Registry entries left behind** section with the number of subkeys and values of each key, or says **No registry entries left behind.** **None is selected by default**, and if you close the window without pressing **Remove selected**, nothing is deleted. The keys can hold licenses or activation data, and other plugins of the same publisher may share them, so deletion is permanent and you should tick only keys you are sure about.

- Only keys directly under `HKCU\Software` or `HKLM\SOFTWARE` (including `WOW6432Node`), or one level below them, whose name is exactly the publisher or "Publisher Product" are offered, plus the publisher's own entry in "Installed apps" if it is still there. Anything under `Microsoft`, `Windows`, `Classes` or `Policies`, Steinberg's shared key, and keys with more than 500 subkeys or values are never offered, and at most 20 keys are listed.
- Before anything is deleted, every selected key is exported to a `.reg` file in the `registry-backups` folder next to the settings (the data folder in portable mode). The dialog tells you where the backup is. If a backup cannot be written, nothing is deleted. To restore a key, double-click its `.reg` file.
- Keys under `HKLM` need administrator permission: if Deplug is not running as administrator, Windows shows one permission prompt.
- If the restore point checkbox is off, the dialog warns that the `.reg` backup is the only way back.

## Restore point on Windows

On Windows the dialog has a checkbox, on by default (you can change the default in [Settings](/settings#uninstall)): **Create a system restore point before uninstalling**. This is the same safety net Revo Uninstaller offers. If something goes wrong with your system after removing a plugin, you can roll back from Windows' System Restore.

Windows asks for administrator permission to create a restore point (a UAC prompt), because restore points are a system-level change. The checkbox is not shown on macOS and Linux.

### Why creating a restore point can fail

If it fails, Deplug shows the reason and asks whether to **continue without a restore point**. You choose: nothing is removed behind your back.

- **UAC was declined or cancelled.** The administrator prompt was closed or denied. Run the uninstall again and accept it.
- **System Protection is turned off.** Windows only creates restore points for drives where System Protection is on. Open "Create a restore point" in the Start menu, select your system drive, press **Configure** and turn protection on.
- **Windows created one in the last 24 hours.** By default Windows allows one automatically-created restore point per 24 hours. Deplug cannot override that. If you remove plugins in separate steps, the first restore point covers the rest of the day: continue without a new one.

A batch asks only once: if the restore point fails, you choose whether to continue for all the selected plugins.

Other errors show the message reported by Windows PowerShell.

## Keyboard shortcuts

Shortcuts that act on the list do nothing while a dialog or menu is open, and the plain keys are ignored while you type in a field. On macOS use **Cmd** instead of **Ctrl**. Press **?** to show this list in the app.

| Keys | Action |
| --- | --- |
| **Ctrl+F** | Focus the search field |
| **Ctrl+A** | Select every plugin shown in the current view |
| **Esc** | Clear the search, then the selection |
| **Del** | Uninstall the selected plugins (opens the uninstall dialog) |
| **Ctrl+E** | Open the export menu |
| **Ctrl+,** | Open settings |
| **F5** or **Ctrl+R** | Rescan plugins |
| **?** | Show the shortcuts |
