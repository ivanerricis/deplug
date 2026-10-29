#!/usr/bin/env bash
# Installs the third-party Claude Code skills used for UI work into .claude/skills/.
# Each skill is pinned to a reviewed commit; bump the SHA only after reviewing the diff.
# The installed copies are git-ignored (see .gitignore) to keep the repository small.
#
#   ./scripts/install-skills.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/.claude/skills"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# name | repository | pinned commit | skill path inside the repository
SKILLS=(
  "design-taste-frontend|Leonxlnx/taste-skill|12af471f627f866411b4bd785b19646d3672784c|skills/taste-skill"
  "logo-design|kaankiziltug/logo-design-skill|734090317a2155c5bf1ae8bd4cc85c6848a0128f|skills/logo-design"
  "ui-ux-pro-max|nextlevelbuilder/ui-ux-pro-max-skill|28b3b8dee8c976df4fa3e94aed4e092ad43fcb03|.claude/skills/ui-ux-pro-max"
  "webapp-testing|anthropics/skills|ca45fc496a3436251f191354091d557da31c15b5|skills/webapp-testing"
)

mkdir -p "$DEST"
for entry in "${SKILLS[@]}"; do
  IFS='|' read -r name repo sha path <<<"$entry"
  echo "Installing $name ($repo@${sha:0:7})"
  dir="$TMP/$name"
  git init -q "$dir"
  GIT_LFS_SKIP_SMUDGE=1 git -C "$dir" fetch -q --depth 1 "https://github.com/$repo" "$sha"
  git -C "$dir" checkout -q FETCH_HEAD
  rm -rf "${DEST:?}/$name"
  cp -R "$dir/$path" "$DEST/$name"
done
echo "Done: $(ls "$DEST" | tr '\n' ' ')"
