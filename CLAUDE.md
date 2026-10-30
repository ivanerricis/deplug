# Deplug

Deplug is a Tauri 2 desktop app (Rust backend, React 19 + TypeScript + Tailwind 4 frontend) that finds the
VST2, VST3, AAX, AU and CLAP plugins on a computer and uninstalls the ones the user picks. Repository:
`ivanerricis/deplug`. Project skills live in `.claude/skills/deplug-*`; third-party UI skills are installed
with `scripts/install-skills.sh` and are git-ignored.

## Standing rules (from the owner)
- Code comments, commit messages, PR titles and bodies are written in **English**. The UI and docs exist in
  **English and Italian**: every string goes in both `src/i18n/en.ts` and `src/i18n/it.ts` (key parity is tested),
  every user-visible doc change in both `docs/` and `docs/it/`.
- Use the **shadcn/ui** components in `src/components/ui` (new-york style, Radix) wherever one exists. The shadcn CLI
  cannot reach its registry from the sandbox: write new components in the same style by hand.
- **No signatures** in commits: no `Co-Authored-By`, no `Claude-Session` trailer, no attribution lines in PR bodies.
- One pull request per theme. `main` is protected (PR + required checks `frontend`, `rust-core`, `tauri` on
  Linux/Windows/macOS). Merge with a merge commit.
- Add every user-visible change to `CHANGELOG.md` under **Unreleased** in the same pull request.
- Safety first for anything that deletes: paths are validated in Rust (`validate_plugin_path`), the frontend never
  supplies what the backend can derive itself, destructive actions are never selected by default.
- Notify the owner (push notification) only when their action is needed; otherwise keep working.

## Layout
- `src/core/**` pure TypeScript logic with unit tests next to it; `src/components/**` UI; `src/i18n/**` strings.
- `src-tauri/src/**` Rust commands (`uninstall.rs`, `vendor.rs`, `leftovers.rs`, `registry_leftovers.rs`, `meta.rs`,
  `syspaths.rs`, `elevation.rs`, `settings.rs`); `src-tauri/portable-core` is a separate crate (settings + portable
  mode), **not** a workspace member: run its tests from its own directory.
- `docs/` is the VitePress site (EN at the root, IT in `docs/it/`), deployed to GitHub Pages.
- `packaging/` holds the release helper scripts; `.github/workflows/` has `ci.yml`, `release.yml`, `docs.yml`.

## Checks before a pull request
See the `deplug-checks` skill. In short: `npm run typecheck`, `npm test`, `cargo fmt --check`,
`cargo clippy --all-targets -- -D warnings`, `cargo test`, the same in `src-tauri/portable-core`, and the
`x86_64-pc-windows-gnu` clippy when Windows-only code changed. There is no ESLint config in the repository.

## Environment notes (cloud sandbox)
- The sandbox cannot run Windows or macOS code: Windows-only code is checked by cross-compiling and clippy only, say so in PRs.
- `gh` works through REST only (no GraphQL); releases cannot be edited or deleted from the sandbox; repository
  settings and Actions secrets are not reachable. Use the GitHub MCP tools for PRs and workflow dispatch.
- Disk is a small fixed quota: share one cargo target dir (`CARGO_TARGET_DIR`), remove worktrees when done.
- Never use `pkill -f` with a pattern that appears in your own command line; kill by PID.
