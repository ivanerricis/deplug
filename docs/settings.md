# Settings

Open the settings with the gear button at the right of the toolbar. The dialog has four sections in a list on the side: **General**, **Scan**, **Uninstall** and **About**. Changes are saved as soon as you make them. Close the dialog with the close button or Esc.

## General {#general}

- **Language**: *System default*, *English* or *Italiano*. It changes the whole interface immediately. *System default* follows the language of your operating system and falls back to English if it is neither English nor Italian.
- **Theme**: *System*, *Light* or *Dark*. *System* follows your operating system's light or dark setting.
- **List**: tick the optional columns of the plugin list: **Path**, **Size**, **Modified** and **Architecture** (the 32/64-bit pill next to the name). The name is always shown. Hidden columns also lose their sort header, and the layout adjusts so nothing is left empty. **Row density** is *Comfortable* (default) or *Compact*, which fits more plugins on screen.
- **Remember the last tab and sort**: on by default. Deplug saves the tab and sort you used last and opens on them next time. Turn it off to always open on the two choices below.
- **Start on tab**: *All*, *VST2*, *VST3*, *AAX* or *AU*; used when remembering is off.
- **Default sort**: the column (*Name*, *Path*, *Size* or *Modified*) and direction (*Ascending* or *Descending*) every section starts with when remembering is off.

## Scan {#scan}

- **Scan on startup**: on by default. Turn it off and Deplug opens with a "Ready to scan" screen; press **Scan now** (or the rescan button) when you want a list.
- **Custom folder depth**: how many levels of subfolders are searched inside the folders you add, from 1 to 10 (default 6). It does not apply to the standard system folders, which are always searched three levels deep.
- **Custom folders**: extra folders to scan, for plugins you copied by hand. Use **Add folder** to pick one and the cross next to a folder to remove it. Removing a folder never touches its files. See [Custom folders](/custom-folders).
- **Exclusions**: names to skip while scanning. Type a pattern and press **Add**; the cross removes it. A pattern is compared with the whole name of a plugin or of a single folder, ignoring upper and lower case, and never with the full path. `*` stands for any text: `*Demo*` skips anything with "demo" in its name, `Backup` skips folders or plugins named exactly Backup, `old_*` skips names that start with "old_". Matching folders are not searched at all and matching plugins are not listed. There is no other pattern syntax. You can add up to 50 patterns of up to 100 characters; blanks and duplicates are ignored.
- **System folders**: the standard locations for your operating system, each with a checkbox. Untick the ones you do not want to scan.

The plugin list refreshes when you close the settings, if anything here changed.

## Uninstall {#uninstall}

- **Create a restore point by default**: sets whether the restore point checkbox starts ticked in the uninstall dialog. You can still change it for each uninstall. Restore points only exist on Windows; on macOS and Linux the setting has no effect and the dialog says so.
- **Delete method**: **Move to trash** (default) keeps removed plugins recoverable. **Delete permanently** removes the files for good: they skip the trash and a system restore point does not cover them. Leftover folders you choose to remove follow the same setting.
- **Ask for confirmation before uninstalling** (on by default): when off, Uninstall runs right away with your saved defaults (restore point, delete method) and shows the result dialog. The publisher's uninstaller and leftover folders are never chosen automatically. Deplug always asks for confirmation when the delete method is **Delete permanently**, whatever this setting says.
- **Always run Deplug as administrator** (Windows only, on by default): Windows asks for permission each time Deplug starts. Plugins in protected folders can then be removed without extra prompts, and programs Deplug starts (such as a publisher's uninstaller) also run with administrator rights. It takes effect the next time Deplug starts. Turn it off if you would rather not see the Windows prompt at every start; if you decline the prompt, Deplug starts normally without administrator rights. The About section shows whether the current session has them.
- **Search the registry for leftovers** (Windows only, off by default): when you uninstall a single plugin, Deplug remembers its publisher and product name, and once the plugin has been removed it looks for registry keys left behind and offers them in a **Registry entries left behind** section of the result view. Nothing is deleted unless you tick keys and press **Remove selected**, and they are backed up to a `.reg` file first. While this is off, the registry is never searched and no registry key can be deleted. See [Registry entries](/using-deplug#registry-entries).

## About {#about}

The About section shows the app name, the **Version**, and the **Mode** (*Standard* or *Portable*). In portable mode it also shows the **Data folder**, and a warning if portable mode could not start, for example because the folder is read-only. See [Portable mode](/portable-mode).

Under **Updates**:

- **Check for updates at startup** (off by default): once a day at most, shortly after the first scan, Deplug asks GitHub whether a newer version exists. If so, a small dot appears on the settings button and a notice at the top of this section links to the release; nothing is downloaded or installed on its own. Failures are silent. The time of the last check is kept in `settings.json`, so it also works in portable mode.
- **Update channel**: *Stable* (default) only offers finished releases; *Pre-release* also offers release candidates. The in-app installer only handles stable releases, so for a pre-release Deplug shows a hint and the **Open release page** button instead.

**Check for updates** looks for a newer published version. On a normal (installed) copy, Deplug can then download and install it for you: press **Download and install**, watch the progress bar, then press **Restart now**. Updates are verified with a signature before they are installed. If the in-app update is not available for your install (for example some Linux packages), or you run a [portable](/portable-mode) copy, which never updates itself because portable copies are replaced by hand, the button **Open release page** takes you to the download instead.

It also has:

- links to the **GitHub page**, the **Documentation**, **Report an issue** and **Release notes**, which open in your browser;
- **Copy diagnostics**, which puts the app version, operating system (name, architecture and the web view's user agent), mode, administrator rights (Windows only), a summary of your settings (language, theme, uninstall and update options), the folders being scanned, the plugin counts per format and architecture, and the app's last 20 errors (time, area and message) on the clipboard, ready to paste into a bug report. It contains no plugin names;
- the license notice.

## Where settings are stored

Everything above lives in a single `settings.json`. Its location, and how to reset it, are in the [FAQ](/faq#where-does-deplug-store-its-data).
