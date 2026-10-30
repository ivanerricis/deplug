---
name: deplug-ui-screenshots
description: How to take screenshots of the Deplug UI in the sandbox with a mocked Tauri backend (Playwright, fake plugins, Windows user agent, widths, themes, languages). Use to verify or show any UI change.
---

# UI screenshots without a Tauri window

The sandbox cannot show the real app on Windows, but the frontend runs in a normal browser if the Tauri bridge is faked.

1. Start Vite from your worktree on a free port and keep its PID: `npx vite --port 5201 & echo $! > /tmp/vite.pid`.
   Kill it by PID when done (`kill $(cat /tmp/vite.pid)`); never `pkill -f`.
2. Run the script next to this file:
   `PORT=5201 OUT=/tmp/shots WIDTHS=640,900,1200 node .claude/skills/deplug-ui-screenshots/screenshots.cjs`
   Options (env): `LANGS=en,it`, `SCHEMES=light,dark`, `ACTION=settings:uninstall` (opens Settings on a tab:
   general, scan, uninstall, about) or `ACTION=tab:VST3` (clicks a format tab) or `ACTION=none`, `FIRST_RUN=1`
   (welcome screen: the mock reports `welcomeSeen: false`), `EMPTY=1` (no plugins), `UA=linux` (default is a Windows user agent).
   Playwright is installed globally at `/opt/node-tools/node_modules/playwright`.
3. The mock in the script answers the commands the app uses (`get_settings`, `save_settings`, `app_info`,
   `system_paths`, `plugin_meta`, `plugin:fs|exists`, `plugin:fs|read_dir`, `plugin:path|resolve_directory`, ...). When
   a new backend command is needed by the screen, add a `case` to the mock (unknown commands return `null`). Fake plugin
   folders live in the `dirs` table at the top.
4. **Look at the pictures** (Read the PNGs) before reporting: check wrapping, overflow, equal control heights, contrast
   in both themes and Italian text, which is longer than English. Save outputs outside the repository (scratchpad).

The screenshots prove layout only; behavior against the real OS is not covered.
