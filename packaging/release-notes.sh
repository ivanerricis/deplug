#!/usr/bin/env bash
# Prints the release notes for a tag (vX.Y.Z or vX.Y.Z-rc.N): the matching CHANGELOG.md section,
# else the Unreleased section, followed by the standard list of downloads.
# Usage: release-notes.sh <tag> [changelog]
set -euo pipefail

tag="${1:?usage: release-notes.sh <tag> [changelog]}"
file="${2:-CHANGELOG.md}"
version="${tag#v}"
version="${version%%-*}"

# Text between "## [<heading>]" and the next "## " heading.
section() {
  awk -v h="## [$1]" '
    index($0, h) == 1 { found = 1; next }
    found && /^## / { exit }
    found { print }
  ' "$file" 2>/dev/null | sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}' | sed '/./,$!d'
}

notes="$(section "$version")"
if [ -z "$notes" ]; then notes="$(section "Unreleased")"; fi
if [ -z "$notes" ]; then notes="See the assets below."; fi

if [[ "$tag" == *-* ]]; then
  printf 'Pre-release for testing; it is not offered to installed copies on the stable channel.\n\n'
fi
printf '%s\n\n' "$notes"
cat <<'F'
### Downloads
Installers: `.msi`/`.exe` (Windows), `.dmg` (macOS), `.deb`/`.rpm`/`.AppImage` (Linux). Installed copies update themselves from the app (Settings > About). Portable builds (no install, data kept next to the app): `*_portable.zip` (Windows, macOS) and `*_portable.tar.gz` (Linux).
F
