# Settings

Open the settings with the gear button at the right of the toolbar. The dialog has four sections in a list on the side: **General**, **Scan**, **Uninstall** and **About**. Changes are saved as soon as you make them. Close the dialog with the close button or Esc.

## General {#general}

- **Language**: *System default*, *English* or *Italiano*. It changes the whole interface immediately. *System default* follows the language of your operating system and falls back to English if it is neither English nor Italian.
- **Theme**: *System*, *Light* or *Dark*. *System* follows your operating system's light or dark setting.

## Scan {#scan}

- **Scan on startup**: on by default. Turn it off and Deplug opens with a "Ready to scan" screen; press **Scan now** (or the rescan button) when you want a list.
- **Custom folder depth**: how many levels of subfolders are searched inside the folders you add, from 1 to 10 (default 6). It does not apply to the standard system folders, which are always searched three levels deep.
- **Custom folders**: extra folders to scan, for plugins you copied by hand. Use **Add folder** to pick one and the cross next to a folder to remove it. Removing a folder never touches its files. See [Custom folders](/custom-folders).
- **System folders**: the standard locations for your operating system, each with a checkbox. Untick the ones you do not want to scan.

The plugin list refreshes when you close the settings, if anything here changed.

## Uninstall {#uninstall}

- **Create a restore point by default**: sets whether the restore point checkbox starts ticked in the uninstall dialog. You can still change it for each uninstall. Restore points only exist on Windows; on macOS and Linux the setting has no effect and the dialog says so.
- **Always run Deplug as administrator** (Windows only, on by default): Windows asks for permission each time Deplug starts. Plugins in protected folders can then be removed without extra prompts, and programs Deplug starts (such as a publisher's uninstaller) also run with administrator rights. It takes effect the next time Deplug starts. Turn it off if you would rather not see the Windows prompt at every start; if you decline the prompt, Deplug starts normally without administrator rights. The About section shows whether the current session has them.

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
