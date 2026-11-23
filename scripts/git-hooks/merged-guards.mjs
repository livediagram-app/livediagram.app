// The repo guards on HEAD merged with origin/main (docs/ci.md "Before a push"). A pull request's CI checks the
// merge of the branch with `main`, so a branch can pass every guard alone and fail there: `main` gained a
// guard, another pull request merged an offender, or both sides added the same code (the copies guard) or
// touched the same baseline list. This makes that merge in a temporary worktree and runs, in it:
//
// - the copies, file size and markup guards (plain scripts, no modules needed);
// - the guard tests of every suite turbo.json declares as reading other workspaces (pre-push-guards.mjs: the
//   Callout guard, the site's style guards, next-config's tree scans ...), with this worktree's node_modules
//   linked in.
//
// A merge with conflicts cannot be checked and says so. Nothing is written to the branch or the work tree: the
// merge is a commit no ref points at, and the worktree is removed at the end.
//
//   node scripts/git-hooks/merged-guards.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoReaders } from '../../.github/scripts/ci-readers.mjs';
import { SCAN_TIMEOUT, scanTests, workspaceDirs } from './pre-push-guards.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_REF = process.env.PRE_PUSH_BASE_REF || 'origin/main';
const SCRIPT_GUARDS = [
  ['no new copies across products', '.github/scripts/duplicate-guard.mjs'],
  ['no new files over 800 lines', '.github/scripts/file-size-guard.mjs'],
  ['one path for markup', '.github/scripts/raw-html-guard.mjs'],
];

/**
 * What `git merge-tree --write-tree` answered: the merged tree, or why there is none.
 * @param {{ status: number | null, stdout: string }} run
 * @returns {{ tree: string } | { skip: string }}
 */
export function mergedTree(run) {
  const tree = run.stdout.split('\n')[0]?.trim() ?? '';
  if (run.status === 0 && /^[0-9a-f]{40,64}$/.test(tree)) return { tree };
  if (run.status === 1) return { skip: `the push conflicts with ${BASE_REF}: merge it to check` };
  return { skip: 'this git cannot merge without a work tree (2.38 or newer can)' };
}

/** A suite with this many scan tests or fewer runs them all in the merged tree; a larger one only its named guards. */
export const MERGED_ALL_MAX = 5;

/**
 * The scan tests to run in the merged tree, of one suite's.
 * - Never a `.tsx` test: it renders, and its setup file (`@liveworkspace/vitest-config/react-cleanup`) resolves
 *   through the linked modules to this worktree, outside the root Vite serves files from.
 * - A suite with a handful runs them all (next-config's tree scans, the Callout guard's neighbours); a large
 *   one (the site's 31, the help centre's 43: 104 s of CPU time for every suite's, measured) only its
 *   `*guard.test.*` files. The rest ran on the push alone and run on CI.
 * @param {string[]} tests
 */
export function mergedTests(tests) {
  const plain = tests.filter((file) => !/\.[jt]sx$/.test(file));
  return plain.length <= MERGED_ALL_MAX
    ? plain
    : plain.filter((file) => /guard\.test\.[cm]?[jt]s$/.test(file));
}

/** @param {string} cwd @param {string[]} args */
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function main() {
  const merge = mergedTree(
    spawnSync('git', ['merge-tree', '--write-tree', 'HEAD', BASE_REF], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );
  if ('skip' in merge) {
    console.log(`[merged] skipped: ${merge.skip}`);
    return 0;
  }
  const commit = git(
    ROOT,
    '-c',
    'user.name=pre-push',
    '-c',
    'user.email=pre-push@localhost',
    'commit-tree',
    merge.tree,
    '-p',
    'HEAD',
    '-p',
    BASE_REF,
    '-m',
    `pre-push: HEAD merged with ${BASE_REF}`,
  );
  const dir = mkdtempSync(path.join(tmpdir(), 'liveworkspace-merged-'));
  const remove = () => {
    spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT, stdio: 'ignore' });
    rmSync(dir, { recursive: true, force: true });
    spawnSync('git', ['worktree', 'prune'], { cwd: ROOT, stdio: 'ignore' });
  };
  for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM']))
    process.on(signal, () => {
      remove();
      process.exit(1);
    });
  /** @type {string[]} */
  const failed = [];
  try {
    git(ROOT, 'worktree', 'add', '--quiet', '--detach', dir, commit);
    for (const [label, script] of SCRIPT_GUARDS) {
      if (!existsSync(path.join(dir, /** @type {string} */ (script)))) continue;
      const run = spawnSync('node', [/** @type {string} */ (script)], {
        cwd: dir,
        stdio: 'inherit',
      });
      if (run.status !== 0) failed.push(/** @type {string} */ (label));
    }
    // The merged tree has no modules of its own: every workspace gets this worktree's, linked in (a scan test
    // may read another workspace's, as the site's licences test does).
    const dirs = workspaceDirs(dir);
    for (const ws of new Set(['.', ...dirs.values()]))
      if (existsSync(path.join(ROOT, ws, 'node_modules')) && existsSync(path.join(dir, ws)))
        symlinkSync(path.join(ROOT, ws, 'node_modules'), path.join(dir, ws, 'node_modules'));
    for (const reader of repoReaders(path.join(dir, 'turbo.json'))) {
      const ws = dirs.get(reader.name);
      if (!ws) continue;
      const vitest = path.join(ROOT, ws, 'node_modules/vitest/vitest.mjs');
      const tests = mergedTests(scanTests(dir, ws));
      // A suite main added, not installed here yet, is left to CI.
      if (tests.length === 0 || !existsSync(vitest)) continue;
      const run = spawnSync(process.execPath, [vitest, 'run', ...tests, SCAN_TIMEOUT], {
        cwd: path.join(dir, ws),
        encoding: 'utf8',
      });
      if (run.status === 0)
        console.log(`[merged] passed: ${reader.name} (${tests.length} guard tests)`);
      else {
        process.stdout.write(`${run.stdout ?? ''}${run.stderr ?? ''}`);
        failed.push(`${reader.name}: guard tests`);
      }
    }
  } finally {
    remove();
  }
  if (failed.length === 0) {
    console.log(`[merged] passed: the repo guards hold on this push merged with ${BASE_REF}`);
    return 0;
  }
  console.error(`[merged] failed on this push merged with ${BASE_REF}, as CI would:`);
  for (const label of failed) console.error(`[merged]   ${label}`);
  console.error(
    `[merged] merge ${BASE_REF} into the branch to see it in place; where the offender is on main itself, fix it there first`,
  );
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
