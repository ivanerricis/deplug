# Safety and privacy

## Nothing leaves your machine on its own

Deplug has no account, no analytics, no telemetry and no automatic update check. It scans local folders and shows you the result. The one network request it can make is the **Check for updates** button in Settings → About, which only runs when you click it and only reads the public list of releases from GitHub; nothing about your computer or plugins is sent. The only thing it writes is a small `settings.json` ([where](/faq#where-does-deplug-store-its-data)).

## Files go to the trash

Uninstalling uses the operating system's trash: the Recycle Bin on Windows, Trash on macOS, your desktop's trash on Linux. Nothing is permanently deleted by Deplug. To undo a removal, restore the item from the trash.

## Every removal is confirmed

Deplug never removes anything in bulk or in the background. You pick one plugin, read its full path in the dialog and confirm.

## Paths are validated

Before anything is moved to the trash, the backend re-checks the path and refuses it unless **all** of these are true:

- it is an absolute path with no `..` parts;
- it is not a filesystem root and not your home folder, and is not suspiciously short;
- its name ends with a plugin extension: `.dll`, `.vst`, `.vst3`, `.aaxplugin`, `.component` or `.so`;
- it still exists.

So even if a custom folder points at something large, Deplug can only ever trash an individual plugin file or bundle, never a folder of your documents.

## The publisher's uninstaller and leftovers

For a single plugin, Deplug can offer to run the **uninstaller the publisher registered** with the system. This is the only case where Deplug starts another program, and it never happens on its own: the dialog shows the exact command, explains that the program may ask for administrator permission, and only runs it when you choose that option and press **Run uninstaller**. Deplug does not run commands it considers unsafe.

**Leftover folders** are only suggestions found in a fixed set of per-user and shared data locations. They are unselected by default and go to the trash, like everything else; the backend refuses any folder it did not derive itself for that plugin.

## Restore points

On Windows the optional restore point is created by Windows PowerShell's `Checkpoint-Computer` in an elevated process after the usual UAC prompt. The description is sanitised before it is passed on. Deplug asks for elevation only for this step and never keeps administrator rights.

## Unsigned builds

Releases are built by public GitHub Actions workflows from the tagged source, but they are not code-signed. See the [FAQ](/faq#windows-says-the-app-is-from-an-unknown-publisher) for the warnings this causes. Only download from the official Releases page.
