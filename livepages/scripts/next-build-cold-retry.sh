#!/usr/bin/env bash
# Runs a Next build command; when it fails on a build cache restored by next-cache-restore, wipes the
# cache and runs it once more from cold (docs/specs/003-system-architecture/e2e-smoke.md "Cost controls").
# A cache only ever saves time: a bad one must cost a cold build, never a red run. A build that fails
# cold, or fails again after the wipe, fails the step.
#
#   scripts/next-build-cold-retry.sh pnpm --filter @livediagram/live build
#
# Reads NEXT_CACHE_RESTORED and NEXT_CACHE_PATHS (one directory per line), set by next-cache-restore.
set -euo pipefail

if "$@"; then
  exit 0
fi

if [ "${NEXT_CACHE_RESTORED:-0}" != "1" ]; then
  echo "[next-cache] the build failed without a restored cache; not retrying"
  exit 1
fi

echo "::warning title=Next build cache::The build failed on the restored cache; wiping it and building cold"
while IFS= read -r dir; do
  if [ -n "${dir}" ]; then
    echo "[next-cache] wiping ${dir}"
    rm -rf -- "${dir}"
  fi
done <<< "${NEXT_CACHE_PATHS:-}"

"$@"
