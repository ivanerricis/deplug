#!/usr/bin/env bash
# Upload a file to the (draft) release. Usage: upload-asset.sh <file>
# Needs GH_TOKEN, GITHUB_REF_NAME, GITHUB_REPOSITORY; optional RELEASE_ID
# (tauri-action output) used as fallback when lookup by tag fails for drafts.
set -euo pipefail
file="$1"
if gh release upload "$GITHUB_REF_NAME" "$file" --clobber; then exit 0; fi
if [ -z "${RELEASE_ID:-}" ]; then exit 1; fi
name="$(basename "$file")"
echo "Tag lookup failed, uploading via release id $RELEASE_ID"
old="$(gh api "repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID/assets" --jq ".[] | select(.name==\"$name\") | .id")"
if [ -n "$old" ]; then
  gh api --method DELETE "repos/$GITHUB_REPOSITORY/releases/assets/$old"
fi
gh api --method POST "https://uploads.github.com/repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID/assets?name=$name" \
  -H "Content-Type: application/octet-stream" --input "$file"
