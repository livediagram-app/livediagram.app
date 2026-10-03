// Points git at the tracked hooks in .githooks/ (docs/specs/003-system-architecture/testing.md
// "Before a push"). Run by the root `prepare` script on every `pnpm install`.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HOOKS_PATH = '.githooks';

/**
 * @param {{ ci: boolean, insideWorkTree: boolean, current: string }} state
 * @returns {'skip-ci' | 'skip-no-git' | 'unchanged' | 'set'}
 */
export function hooksPathAction({ ci, insideWorkTree, current }) {
  if (ci) return 'skip-ci';
  if (!insideWorkTree) return 'skip-no-git';
  return current === HOOKS_PATH ? 'unchanged' : 'set';
}

/** @param {string[]} args */
function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function main() {
  let insideWorkTree = false;
  try {
    insideWorkTree = git('rev-parse', '--is-inside-work-tree') === 'true';
  } catch {
    // Not a repository (a source tarball): reported below.
  }
  let current = '';
  if (insideWorkTree) {
    try {
      current = git('config', '--get', 'core.hooksPath');
    } catch {
      // Unset: git exits 1.
    }
  }
  const action = hooksPathAction({ ci: Boolean(process.env.CI), insideWorkTree, current });
  if (action === 'skip-ci') console.log('[git-hooks] skipped: CI');
  else if (action === 'skip-no-git') console.log('[git-hooks] skipped: not a git work tree');
  else if (action === 'unchanged') console.log(`[git-hooks] core.hooksPath is ${HOOKS_PATH}`);
  else {
    git('config', 'core.hooksPath', HOOKS_PATH);
    console.log(
      `[git-hooks] core.hooksPath set to ${HOOKS_PATH}${current ? ` (was ${current})` : ''}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
