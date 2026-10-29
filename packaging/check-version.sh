#!/usr/bin/env bash
# Fails when the git tag (vX.Y.Z or vX.Y.Z-rc.N) does not match the app version
# declared in package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json.
set -euo pipefail

tag="${1:?usage: check-version.sh <tag>}"
expected="${tag#v}"
expected="${expected%%-*}" # prerelease suffix is not part of the file versions

pkg=$(sed -nE 's/^[[:space:]]*"version":[[:space:]]*"([^"]+)".*/\1/p' package.json | head -1)
cargo=$(sed -nE 's/^version[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' src-tauri/Cargo.toml | head -1)
tauri=$(sed -nE 's/^[[:space:]]*"version":[[:space:]]*"([^"]+)".*/\1/p' src-tauri/tauri.conf.json | head -1)

status=0
for entry in "package.json=$pkg" "src-tauri/Cargo.toml=$cargo" "src-tauri/tauri.conf.json=$tauri"; do
  file="${entry%%=*}"; found="${entry#*=}"
  if [ "$found" != "$expected" ]; then
    echo "::error file=$file::version is '$found' but tag $tag expects '$expected'"
    status=1
  fi
done
exit $status
