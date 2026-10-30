---
name: deplug-new-setting
description: Checklist for adding or changing a Deplug user setting end to end (portable-core struct, serde default, frontend normalization, settings tab, EN/IT strings, docs, changelog, tests). Use whenever a setting is added, renamed or its default changes.
---

# Adding a setting

1. **Rust** `src-tauri/portable-core/src/lib.rs`: add the field to `Settings` (camelCase in JSON via the struct's
   serde attribute), a default in `impl Default for Settings`, validation in `Settings::sanitized()` for enums/ranges,
   and tests: default value, old file without the field, invalid value falls back, save/load round trip. If an old
   file must load with a value different from the struct default, give the field its own `#[serde(default = "...")]`
   (this is how `welcome_seen` works: existing installs count as welcomed). Changing a default only affects files that
   do **not** contain the field; an explicit saved value stays.
2. **Frontend** `src/core/settings/AppSettings.ts`: type, `DEFAULT_SETTINGS`, `normalizeSettings` (wrong type or
   unknown enum value falls back to the default), and cases in `src/core/settings/Settings.test.ts`.
3. **UI** `src/components/settings/{General,Scan,Uninstall,About}Section.tsx` with `SettingRow` and a shadcn control
   (Switch, Select, ToggleGroup, Input). OS-specific settings render only on that OS (see how `runAsAdmin` checks
   the platform) and say so in the hint. Settings that change what the scan returns must be part of `scanKey` in
   `src/App.tsx` so closing the dialog rescans.
4. **Strings** in `src/i18n/en.ts` and `it.ts` (label, hint, any error text); keep hints to one or two sentences.
5. **Docs**: `docs/settings.md` and `docs/it/settings.md` (default stated), and any page that mentions the behavior
   (`using-deplug`, `safety-and-privacy`, `faq`).
6. **Changelog**: a line under `Unreleased` in `CHANGELOG.md`.
7. **Diagnostics** (`src/core/diagnostics.ts`) when the setting helps debug problems; never include plugin names.
8. Run the `deplug-checks` skill (portable-core tests are separate from the app crate tests).

Pitfalls: portable-core is not a workspace member (test it from its own directory); the struct literal in the
round-trip test and the equality tests built on `..Settings::default()` break when a default changes; the shared
cargo target dir may need a `touch` of both `lib.rs` files after switching branches.
