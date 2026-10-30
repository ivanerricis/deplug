---
name: deplug-release
description: How to cut a Deplug release or release candidate (changelog, version check, manual workflow dispatch, verifying the 17 assets and latest.json, publishing the draft). Use when asked to release, tag, build a release candidate or publish a version.
---

# Releasing Deplug

## Rules of the pipeline
- `.github/workflows/release.yml` runs **only by hand** (Actions -> Release -> Run workflow, input `tag`, e.g. `v0.1.1` or
  `v0.1.1-rc.1`). It is not triggered by tag pushes: publishing a draft creates the tag, and a build on that push would
  touch the published release.
- A tag with a `-` suffix is a **pre-release**; without it, a normal release. The result is always a **draft**.
- The workflow first runs `packaging/check-version.sh`: `package.json`, `src-tauri/Cargo.toml` and
  `src-tauri/tauri.conf.json` must hold the version of the tag (without the `-rc.N` part). Bump all three (and
  `package-lock.json` / `Cargo.lock` through the normal tooling) in a PR before tagging a new version.
- It needs the repository secret `TAURI_SIGNING_PRIVATE_KEY` (updater signing key, no password) and fails early
  with a clear message when it is missing. Never print, commit or send the key.
- The release body comes from `CHANGELOG.md` through `packaging/release-notes.sh`: the section of the released
  version, or **Unreleased** for release candidates.

## Steps
1. All wanted PRs merged and green on `main`. For a final release rename `## [Unreleased]` in `CHANGELOG.md` to
   `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it and fix the compare links; merge that PR.
2. Bump the version files first if it is a new version number (see above).
3. Dispatch the workflow on `main` with the tag (GitHub MCP `actions_run_trigger`, workflow `release.yml`, ref `main`,
   inputs `{"tag": "vX.Y.Z"}`). Confirm the run's `headSha` is the current `main`.
4. Wait for the three build jobs. Re-running the same tag replaces assets of the same name in the existing draft
   (drafts cannot be deleted from the sandbox).
5. Verify with REST: `gh api repos/ivanerricis/deplug/releases --jq '.[]|select(.tag_name=="vX.Y.Z")|{draft,prerelease,assets:[.assets[].name]}'`.
   Expect 17 assets: `setup.exe`, `.msi`, `.dmg`, `.app.tar.gz`, `.AppImage`, `.deb`, `.rpm`, the `.sig` files of the
   updater bundles, three `*_portable.*` archives and `latest.json`.
6. Notify the owner. **The owner publishes** the draft (Releases -> Edit -> Publish release); the sandbox cannot edit or
   delete releases. Publishing creates the tag. The in-app updater only sees **published, non-pre-release** releases
   through `latest.json`, so updates can only be tested with two published versions.
7. If the owner pastes release notes by hand, give them the output of `bash packaging/release-notes.sh vX.Y.Z`.

## Do not
- Do not push release tags from the sandbox (the proxy refuses) and do not restore the `push: tags` trigger.
- Do not change the updater public key in `tauri.conf.json` without the matching private key secret: installed copies
  would no longer accept updates.
