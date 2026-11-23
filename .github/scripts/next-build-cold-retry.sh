#!/usr/bin/env bash
# Runs a Next build command; when it fails on a build cache restored by next-cache-restore, wipes the
# cache and runs it once more from cold (each product's docs/specs/003-system-architecture/e2e-smoke.md
# "Cost controls"). A cache only ever saves time: a bad one must cost a cold build, never a red run. A
# build that fails cold, or fails again after the wipe, fails the step. One copy for every product.
#
#   bash "${GITHUB_WORKSPACE}/.github/scripts/next-build-cold-retry.sh" pnpm --filter @livediagram/editor build
#
# No retry when `next build` itself finished (it printed its route table) and a step after it failed,
# such as a first-load budget: that failure is the code's, and a cold rebuild would only fail it again
# minutes later (2026-11-19, seven products each rebuilt the Explorer cold over a 0.1 KiB budget miss).
#
# Reads NEXT_CACHE_RESTORED and NEXT_CACHE_PATHS (one directory per line), set by next-cache-restore.
set -euo pipefail

log="$(mktemp)"
trap 'rm -f -- "${log}"' EXIT

if "$@" 2>&1 | tee "${log}"; then
  exit 0
fi

if [ "${NEXT_CACHE_RESTORED:-0}" != "1" ]; then
  echo "[next-cache] the build failed without a restored cache; not retrying"
  exit 1
fi

# `next build` prints its route table ("Route (app)" or "Route (pages)") only once it has compiled.
if grep -qE '^Route \((app|pages)\)' "${log}"; then
  echo "[next-cache] next build finished and a later step failed; the cache is not the cause, not retrying"
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
