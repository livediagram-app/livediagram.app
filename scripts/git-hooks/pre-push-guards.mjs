// The pre-push hook's guard steps (docs/ci.md "Before a push"; the plan is pre-push.mjs): the checks that
// `vitest related` can never reach, because they read files from disk instead of importing them, and the ones
// that only fail once the push meets `main`.
//
// - Scan tests: a workspace's tests that read files (`readFileSync`, `readdirSync`, `git grep` ...) or are named
//   `*guard.test.*`. The suites turbo.json declares as reading other workspaces (ci-readers.mjs: the site, the
//   help centre, `@liveworkspace/ui`'s Callout guard, `@liveworkspace/next-config`'s tree scans ...) run theirs
//   when the push changes a file they read, though the push never touches the workspace itself.
// - Coverage: a changed workspace that enforces coverage thresholds and has a small suite runs it whole, with
//   coverage, in place of its related run.
// - CI script tests, when the push changes the scripts they test.
// - Merged guards (merged-guards.mjs): the repo guards on the push merged with origin/main, where main moved on.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {import('./pre-push.mjs').Step} Step
 * @typedef {import('./pre-push.mjs').Change} Change
 * @typedef {import('./pre-push.mjs').Workspace} Workspace
 * @typedef {{ name: string, include: RegExp[], exclude: RegExp[] }} Reader  ci-readers.mjs
 */

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
/** A test that reads files rather than importing them: what it reads is invisible to `vitest related`. */
const READS_FILES = String.raw`(readFileSync|readdirSync|execFileSync|globSync)\(`;
const GUARD_NAME = /guard\.test\.[cm]?[jt]sx?$/;
/** Never a unit test: Playwright's specs and fixtures. */
const E2E = /(^|\/)e2e\//;
/** The site's telemetry chart tests have a step of their own (pre-push.mjs), run once for every product. */
export const EMITTERS_TEST = /^app\/telemetry\/[^/]+\/metric-emitters\.test\.ts$/;

/**
 * Scan tests read thousands of files and shell out to git: on a machine several agents share (a load of 100 on
 * 10 cores, measured) `git grep` alone passed vitest's 5 s limit. They assert what they find, not how long it
 * took, so they get a minute.
 */
export const SCAN_TIMEOUT = '--testTimeout=60000';

/**
 * A suite up to this size runs whole, with coverage, where its workspace enforces thresholds. Measured at a load
 * of 50 on 10 cores: @liveplanner/items, the largest under it (182 test files), 31 s and 57 s of CPU time;
 * the packages' median 45 s. Over it today: @liveworkspace/workbench (546) and @liveplanner/api (252).
 */
export const COVERAGE_MAX_FILES = 200;
/**
 * Suites whose coverage stays CI's whatever their size: the product apis (140 to 252 test files; 46 s to 176 s
 * measured, a whole Worker's suite on every push that touches it).
 */
export const COVERAGE_ON_CI = /\/apps\/api$/;

/**
 * A workspace's scan tests, relative to it: its tracked tests that read files or are named `*guard.test.*`.
 * @param {string} root  the repository's root (or a merged tree's)
 * @param {string} dir  the workspace, relative to the root
 * @returns {string[]}
 */
// git run at `root` itself: a pre-push hook's GIT_DIR, GIT_INDEX_FILE and the like would otherwise win over `cwd`.
const AT_ROOT = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);

export function scanTests(root, dir) {
  /** @param {string[]} args */
  const lines = (args) => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        env: AT_ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
        .split('\n')
        .filter(Boolean);
    } catch {
      // git grep exits 1 when nothing matches.
      return [];
    }
  };
  const reading = lines(['grep', '-lE', READS_FILES, '--', dir]);
  const named = lines(['ls-files', '--', dir]).filter((file) => GUARD_NAME.test(file));
  return [...new Set([...reading, ...named])]
    .filter((file) => TEST_FILE.test(file) && !E2E.test(file))
    .map((file) => path.posix.relative(dir, file))
    .filter((file) => !EMITTERS_TEST.test(file))
    .sort();
}

/**
 * Every workspace's folder by its package name, from the tracked manifests.
 * @param {string} root
 * @returns {Map<string, string>}
 */
export function workspaceDirs(root) {
  const manifests = execFileSync('git', ['ls-files', '--', 'package.json', '*/package.json'], {
    cwd: root,
    env: AT_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => file && !file.includes('node_modules/'));
  /** @type {Map<string, string>} */
  const dirs = new Map();
  for (const manifest of manifests) {
    try {
      const { name } = JSON.parse(readFileSync(path.join(root, manifest), 'utf8'));
      if (name) dirs.set(name, path.posix.dirname(manifest));
    } catch {
      // A manifest that does not parse names no workspace.
    }
  }
  return dirs;
}

/**
 * Whether a workspace enforces coverage thresholds: a `test:coverage` script (what CI's Tests job runs for
 * it) and thresholds in its vitest config.
 * @param {string} root
 * @param {string} dir
 * @param {Record<string, string>} scripts
 */
export function enforcesCoverage(root, dir, scripts) {
  if (!/\bvitest\b.*--coverage/.test(scripts['test:coverage'] ?? '')) return false;
  const abs = path.join(root, dir);
  return readdirSync(abs)
    .filter((name) => /^vitest\.config\.[cm]?[jt]s$/.test(name))
    .some((name) => /\bthresholds\b/.test(readFileSync(path.join(abs, name), 'utf8')));
}

/**
 * The readers a push reaches without touching them: each suite turbo.json declares as reading other
 * workspaces, where a changed file falls in what it reads, with its scan tests. A workspace the push itself
 * changes is left out (its own guard step runs them).
 * @param {Change[]} changes
 * @param {{
 *   readers: Reader[],
 *   workspaceNamed: (name: string) => Workspace | null,
 *   scanTests: (dir: string) => string[],
 *   touched: Set<string>,
 *   maxWorkers?: number,
 * }} ctx
 * @returns {Step[]}
 */
export function readerSteps(
  changes,
  { readers, workspaceNamed, scanTests: scan, touched, maxWorkers },
) {
  const workers = maxWorkers ? [`--maxWorkers=${maxWorkers}`] : [];
  const files = changes.map((c) => c.path);
  /** @type {Step[]} */
  const steps = [];
  for (const reader of [...readers].sort((a, b) => a.name.localeCompare(b.name))) {
    const reached = files.some(
      (file) =>
        reader.include.some((re) => re.test(file)) && !reader.exclude.some((re) => re.test(file)),
    );
    if (!reached) continue;
    const ws = workspaceNamed(reader.name);
    if (!ws?.vitest || touched.has(ws.dir)) continue;
    const tests = scan(ws.dir);
    if (tests.length === 0) continue;
    steps.push({
      label: `${ws.name}: guard tests (it reads what the push changes)`,
      cmd: 'pnpm',
      args: ['--filter', ws.name, 'exec', 'vitest', 'run', ...tests, SCAN_TIMEOUT, ...workers],
      parallel: true,
    });
  }
  return steps;
}

/**
 * The CI script tests (ci.yml's "CI script tests"), when the push changes a script they test.
 * @param {Change[]} changes
 * @param {string[]} tests  the test files, relative to the root
 * @returns {Step[]}
 */
export function ciScriptSteps(changes, tests) {
  const reached = changes.some((c) => /^(\.github\/scripts|scripts\/git-hooks)\//.test(c.path));
  if (!reached || tests.length === 0) return [];
  return [{ label: 'CI script tests', cmd: 'node', args: ['--test', ...tests] }];
}

/**
 * The CI script tests on disk, relative to the root.
 * @param {string} root
 */
export function ciScriptTests(root) {
  return ['.github/scripts', 'scripts/git-hooks'].flatMap((dir) =>
    existsSync(path.join(root, dir))
      ? readdirSync(path.join(root, dir))
          .filter((name) => name.endsWith('.test.mjs'))
          .sort()
          .map((name) => `${dir}/${name}`)
      : [],
  );
}

/**
 * The repo guards on the push merged with origin/main, where main has commits the push lacks: a guard main
 * added, an offender another pull request merged, a copy of something main also gained. CI checks that
 * merge, so the push alone can pass here and fail there.
 * @param {boolean} mainAhead
 * @returns {Step[]}
 */
export function mergedSteps(mainAhead) {
  if (!mainAhead) return [];
  return [
    {
      label: 'the repo guards on this push merged with origin/main',
      cmd: 'node',
      args: ['scripts/git-hooks/merged-guards.mjs'],
      parallel: true,
      // It says when a conflict kept it from checking anything.
      show: true,
    },
  ];
}

/**
 * The site's build, which ends in its first-load budget (liveworkspace/apps/site/scripts/first-load-budget.ts):
 * minutes, so only when asked for (`--site-build`).
 * @returns {Step}
 */
export function siteBuildStep() {
  return {
    label: "the site's build and first-load budget",
    cmd: 'pnpm',
    args: ['--filter', '@liveworkspace/site', 'build'],
  };
}
