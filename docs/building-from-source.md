# Building from source

Deplug is a [Tauri 2](https://tauri.app) app with a React and TypeScript front end and a Rust back end.

## Prerequisites

- **Node.js 24** or newer, with npm.
- **Rust** (stable), through [rustup](https://rustup.rs).
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system:
  - Windows: Microsoft C++ Build Tools and WebView2.
  - macOS: Xcode Command Line Tools.
  - Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf` and a C toolchain.

## Get the code

```bash
git clone https://github.com/ivanerricis/deplug.git
cd deplug
npm ci
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Front end only, in the browser (Tauri APIs are not available) |
| `npm run tauri dev` | The full desktop app with hot reload |
| `npm run typecheck` | TypeScript check without emitting |
| `npm test` | Front end unit tests (Vitest) |
| `npm run build` | Type check and production front end build into `dist/` |
| `npm run tauri build` | Production installers for your system |

Rust tests live next to the code:

```bash
cargo test --manifest-path src-tauri/portable-core/Cargo.toml
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

1. front end: typecheck, tests and a Vite build;
2. Tauri on Ubuntu, Windows and macOS: build the front end and run Clippy with warnings as errors;
3. the `portable-core` crate: tests and `cargo fmt --check`.

## Releases

Pushing a tag `vX.Y.Z` starts `.github/workflows/release.yml`. It first checks that the versions in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` all match the tag, then builds installers for Windows, macOS (universal) and Linux, packages the portable builds and attaches everything to a **draft** release. Tags with a suffix such as `v0.1.0-rc.1` create a pre-release. Review the draft and publish it by hand.

## These docs

The documentation site is in `docs/` and is built with VitePress. See `docs/README.md`.
