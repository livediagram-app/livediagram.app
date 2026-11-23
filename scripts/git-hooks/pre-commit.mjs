// The pre-commit hook (docs/ci.md "Before a push"): Prettier over the staged files, a second or two, so a
// format slip is caught at the commit even when the push skips the pre-push hook (`--no-verify`). Format
// was the most common Checks failure CI found after 2026-11-23 that the hook would have stopped. A
// product's files are checked from its own folder, so its .prettierignore applies, as CI's format check
// does (.github/scripts/format-check.sh). It skips, saying so, where Prettier is not installed (a
// worktree that installed nothing), and `git commit --no-verify` skips it.
//
//   .githooks/pre-commit -> node scripts/git-hooks/pre-commit.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|json|md|yml|yaml)$/;
export const PRODUCTS = [
  'livediagram',
  'liveplanner',
  'livedesign',
  'livedocuments',
  'livehuddle',
  'liveknowledge',
];

/**
 * The staged files Prettier checks, by the folder it runs from ('.' for the platform), each path
 * relative to that folder.
 * @param {string[]} files staged paths from the repository root
 * @returns {Map<string, string[]>}
 */
export function formatGroups(files) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const file of files) {
    if (!EXTENSIONS.test(file) || file === 'pnpm-lock.yaml') continue;
    const top = file.split('/')[0];
    const dir = PRODUCTS.includes(top) ? top : '.';
    const rel = dir === '.' ? file : file.slice(dir.length + 1);
    groups.set(dir, [...(groups.get(dir) ?? []), rel]);
  }
  return groups;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const prettier = path.join(root, 'node_modules/.bin/prettier');
  if (!existsSync(prettier)) {
    console.log('[pre-commit] Prettier is not installed here; format check skipped');
    return;
  }
  const staged = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\0')
    .filter(Boolean);
  let failed = false;
  for (const [dir, files] of formatGroups(staged)) {
    const run = spawnSync(
      prettier,
      ['--check', '--ignore-unknown', '--log-level=warn', '--', ...files],
      {
        cwd: path.join(root, dir),
        stdio: 'inherit',
      },
    );
    if (run.status !== 0) failed = true;
  }
  if (failed) {
    console.error(
      '[pre-commit] format: run `corepack pnpm exec prettier --write` on the files above, then stage them',
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
