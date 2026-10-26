#!/usr/bin/env bash
# CI's format check for one group (docs/ci.md "Workflows"): Prettier over the files the change touched,
# so new work is held to the format while files nobody has touched since the products moved in (under
# the monorepo's one Prettier config) are left for a format pass of their own. With no BASE, every file.
#
#   BASE=<sha or empty> PRODUCT=<livediagram|…, or empty for the platform> bash .github/scripts/format-check.sh
#
# A product's files are checked from its own folder, so its .prettierignore applies; the platform's
# from the root (packages/, liveworkspace/, docs/, scripts/, .github/ and the root's own files).
set -euo pipefail

EXTENSIONS='\.(ts|tsx|js|jsx|mjs|json|md|yml|yaml)$'

if [ -n "${PRODUCT:-}" ]; then
  if [ -z "${BASE:-}" ]; then
    exec pnpm --dir "${PRODUCT}" format:check
  fi
  files="$(git diff --name-only --diff-filter=ACMR "${BASE}...HEAD" -- "${PRODUCT}" | grep -E "${EXTENSIONS}" | sed "s#^${PRODUCT}/##" || true)"
  cd "${PRODUCT}"
else
  if [ -z "${BASE:-}" ]; then
    exec pnpm exec prettier --check "packages/**/*.{ts,tsx,js,jsx,json,md,yml,yaml}" \
      "liveworkspace/**/*.{ts,tsx,js,jsx,json,md,yml,yaml}" "docs/**/*.md" "scripts/**/*.mjs" \
      "*.{json,md,yml,yaml}" ".github/**/*.{yml,yaml,mjs}"
  fi
  files="$(git diff --name-only --diff-filter=ACMR "${BASE}...HEAD" -- packages liveworkspace docs scripts .github \
    ':(glob)*.json' ':(glob)*.md' ':(glob)*.yml' ':(glob)*.yaml' |
    grep -E "${EXTENSIONS}" | grep -vx 'pnpm-lock.yaml' || true)"
fi

if [ -z "${files}" ]; then
  echo "[format-check] no formattable files changed"
  exit 0
fi
echo "[format-check] $(printf '%s\n' "${files}" | wc -l | tr -d ' ') changed files"
printf '%s\n' "${files}" | tr '\n' '\0' | xargs -0 pnpm exec prettier --check --ignore-unknown --
