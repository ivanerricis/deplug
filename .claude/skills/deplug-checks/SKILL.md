---
name: deplug-checks
description: The checks to run before pushing a Deplug change (frontend, Rust, portable-core, Windows cross-clippy, docs build) and the sandbox quirks that make them fail for the wrong reason. Use before opening or updating a pull request in this repository.
---

# Deplug checks

Run from the repository (or worktree) root. Use one shared cargo target dir to save disk:
`export CARGO_TARGET_DIR=/home/user/shared-target`.

## Frontend
```bash
npm run typecheck
npm test
npx vite build        # when UI code or assets changed
```
There is no ESLint config: `npx eslint` fails by design, skip it.

## Rust (app crate)
```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## portable-core (separate crate, not a workspace member)
```bash
cd src-tauri/portable-core
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```
CI runs this as the `rust-core` job; a formatting diff here fails the PR even when the app crate is clean
(`cargo fmt` inside `portable-core` fixes it).

## Windows-only code (anything under `cfg(windows)`)
```bash
rustup target add x86_64-pc-windows-gnu            # once
sudo apt-get install -y binutils-mingw-w64-x86-64 gcc-mingw-w64-x86-64   # once
cd src-tauri && cargo clippy --target x86_64-pc-windows-gnu --all-targets -- -D warnings
```
This only compiles and lints; nothing Windows-specific can be run here, so say what is unverified in the PR.

## Docs
```bash
cd docs && npm ci && npm run build      # VitePress; also run when docs/ changed
```

## Sandbox quirks
- A bogus "no field `...`" or "mismatched types" error after switching worktrees or merging: the shared target dir
  has stale `portable-core` artifacts. `touch src-tauri/src/lib.rs src-tauri/portable-core/src/lib.rs` and rebuild.
- `node_modules` in extra worktrees: `ln -s /home/user/deplug-admin/node_modules node_modules` (or the main checkout's).
  If typecheck reports missing `@radix-ui/*` or `@tauri-apps/plugin-*` modules, run `npm install` once in the main checkout.
- Merged `main` into a branch? Re-run everything: settings structs, `en.ts`/`it.ts` and `UninstallDialog.tsx` are
  edited by many pull requests and merge cleanly but sometimes compile badly (duplicate entries, array lengths such
  as `GENERIC_DIR_NAMES`).
- CI cancels the previous run when you push again; wait for the check run of the **latest** commit before merging.
