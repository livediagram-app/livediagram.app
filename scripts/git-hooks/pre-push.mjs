// The pre-push hook (docs/ci.md "Before a push"): the fast checks CI's Checks job would fail on, plus the
// tests the push reaches, for what it changes since its merge base with origin/main, so a deterministic
// failure surfaces on the machine in minutes. It asks CI's own planner (.github/scripts/ci-plan.mjs)
// which product groups the change reaches for lint, type check, format and the guards, and runs only the
// tests that import a changed file, plus the guard tests that scan files. Whole suites, coverage and
// E2E are CI's.
//
//   .githooks/pre-push -> node scripts/git-hooks/pre-push.mjs (the push's refs on stdin)
//   node scripts/git-hooks/pre-push.mjs --dry-run   prints the steps for HEAD without running them

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_REF = 'origin/main';
const ZERO_SHA = /^0+$/;

/** @typedef {{ label: string, cmd: string, args: string[], env?: Record<string, string> }} Step */
/**
 * @typedef {{ group: string, filters: string, format: string, base: string }} Group
 */

/** `--filter=a --filter=b` as ci-plan writes it, back into arguments. */
const split = (/** @type {string} */ filters) => filters.split(' ').filter(Boolean);

/**
 * The fast checks for a push, in the order they run, from ci-plan's groups: the repo-wide guards once,
 * then per group what ci.yml's Checks job runs (lint, type check, format, the speed-budget guard).
 * Tests come from `testSteps`: only those the change reaches, never a whole suite (CI runs those).
 * Two turbo tasks at a time, as on CI.
 * @param {{ groups: Group[] }} plan
 * @returns {Step[]}
 */
export function prePushSteps({ groups }) {
  /** @type {Step[]} */
  const steps = [];
  // Repo-wide, so once rather than per group, as every Checks job runs it.
  if (groups.length > 0)
    steps.push(
      {
        label: 'no new copies across products',
        cmd: 'node',
        args: ['.github/scripts/duplicate-guard.mjs'],
      },
      {
        label: 'no new files over 800 lines',
        cmd: 'node',
        args: ['.github/scripts/file-size-guard.mjs'],
      },
      {
        label: 'one path for markup',
        cmd: 'node',
        args: ['.github/scripts/raw-html-guard.mjs'],
      },
    );
  for (const g of groups) {
    steps.push(
      {
        label: `${g.group}: lint and typecheck`,
        cmd: 'pnpm',
        args: [
          'exec',
          'turbo',
          'run',
          'lint',
          'typecheck',
          ...split(g.filters),
          '--continue',
          '--concurrency=2',
        ],
      },
      {
        label: `${g.group}: format`,
        cmd: 'bash',
        args: ['.github/scripts/format-check.sh'],
        env: { BASE: g.base, PRODUCT: g.format },
      },
      {
        label: `${g.group}: speed budgets use CPU time`,
        cmd: 'node',
        args: ['.github/scripts/cpu-budget-guard.mjs'],
        env: { BASE: g.base, PRODUCT: g.format },
      },
    );
  }
  return steps;
}

/**
 * The install a fresh worktree needs first: when the root or a workspace the push changes has no
 * node_modules (a worktree that installed only some packages), a frozen install of the groups' packages
 * and what they depend on (`name...`), so lint and typecheck have their modules. `--ignore-scripts` keeps
 * the root `prepare` from running, so the shared core.hooksPath is never touched. Null when nothing is
 * missing.
 * @param {{ groups: Group[] }} plan
 * @param {Change[]} changes
 * @param {{ workspaceOf: (file: string) => Workspace | null, hasModules: (dir: string) => boolean }} ctx
 * @returns {Step | null}
 */
export function installStep({ groups }, changes, { workspaceOf, hasModules }) {
  if (groups.length === 0) return null;
  const dirs = new Set(['.']);
  for (const change of changes) {
    if (change.status.startsWith('D')) continue;
    const ws = workspaceOf(change.path);
    if (ws) dirs.add(ws.dir);
  }
  const missing = [...dirs].filter((dir) => !hasModules(dir));
  if (missing.length === 0) return null;
  const filters = groups
    .flatMap((g) => split(g.filters))
    .map((f) => (f.endsWith('...') ? f : `${f}...`));
  return {
    label: `install missing modules (${missing.length} without node_modules)`,
    cmd: 'pnpm',
    args: ['install', '--frozen-lockfile', '--ignore-scripts', ...[...new Set(filters)]],
  };
}

/** A source or test file vitest can trace imports from. */
const CODE = /\.[cm]?[jt]sx?$/;

/**
 * @typedef {{ status: string, path: string }} Change  one line of `git diff --name-status`
 * @typedef {{ dir: string, name: string, vitest: boolean }} Workspace
 * @typedef {{
 *   workspaceOf: (file: string) => Workspace | null,
 *   guardTests: (dir: string) => string[],
 *   helpApps: () => Workspace[],
 *   emitterTest: (product: string) => { ws: Workspace, file: string } | null,
 *   maxWorkers?: number,
 * }} TestContext
 */

/**
 * The tests a push reaches, per workspace it changes:
 * - `vitest related` on its changed code files, which runs every test that imports them (and a changed
 *   test itself);
 * - its guard tests, which scan files rather than import them, so `related` never picks them up (an
 *   app's root and `app/` tests, `lib/small-text-contrast.test.ts`, and an api's `src/openapi` tests,
 *   which catch stale generated schemas);
 * - when the push changes a product's code, the site's metric-emitters test for that product, which
 *   fails when a telemetry event has no chart;
 * - when the push deletes or renames a file, every help app's repo-paths test, which checks each repo
 *   path a help article cites.
 * Paths are relative to the workspace, as vitest takes them from there. `maxWorkers` caps each run on a
 * busy machine.
 * @param {Change[]} changes
 * @param {TestContext} ctx
 * @returns {Step[]}
 */
export function testSteps(changes, { workspaceOf, guardTests, helpApps, emitterTest, maxWorkers }) {
  const workers = maxWorkers ? [`--maxWorkers=${maxWorkers}`] : [];
  /** @type {Map<string, { ws: Workspace, files: Set<string> }>} */
  const touched = new Map();
  for (const change of changes) {
    if (change.status.startsWith('D')) continue;
    const ws = workspaceOf(change.path);
    if (!ws?.vitest) continue;
    const entry = touched.get(ws.dir) ?? { ws, files: new Set() };
    touched.set(ws.dir, entry);
    if (CODE.test(change.path)) entry.files.add(path.posix.relative(ws.dir, change.path));
  }
  /** @type {Step[]} */
  const steps = [];
  for (const { ws, files } of [...touched.values()].sort((a, b) =>
    a.ws.dir.localeCompare(b.ws.dir),
  )) {
    if (files.size > 0)
      steps.push({
        label: `${ws.name}: tests the change reaches`,
        cmd: 'pnpm',
        args: [
          '--filter',
          ws.name,
          'exec',
          'vitest',
          'related',
          ...[...files].sort(),
          '--run',
          '--passWithNoTests',
          ...workers,
        ],
      });
    const guards = guardTests(ws.dir);
    if (guards.length > 0)
      steps.push({
        label: `${ws.name}: guard tests`,
        cmd: 'pnpm',
        args: ['--filter', ws.name, 'exec', 'vitest', 'run', ...guards, ...workers],
      });
  }
  const products = new Set(
    changes
      .filter((c) => !c.status.startsWith('D') && CODE.test(c.path))
      .map((c) => c.path.split('/')[0] ?? ''),
  );
  for (const product of [...products].sort()) {
    const emitters = emitterTest(product);
    if (emitters)
      steps.push({
        label: `${product}: every telemetry event has a chart`,
        cmd: 'pnpm',
        args: ['--filter', emitters.ws.name, 'exec', 'vitest', 'run', emitters.file, ...workers],
      });
  }
  if (changes.some((c) => c.status.startsWith('D') || c.status.startsWith('R')))
    for (const help of helpApps())
      steps.push({
        label: `${help.name}: repo paths in help articles`,
        cmd: 'pnpm',
        args: [
          '--filter',
          help.name,
          'exec',
          'vitest',
          'run',
          'lib/repo-paths-in-docs.test.ts',
          ...workers,
        ],
      });
  return steps;
}

/**
 * `git diff --name-status` lines as changes: a rename or copy keeps its new path.
 * @param {string} text
 * @returns {Change[]}
 */
export function parseNameStatus(text) {
  return text
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((parts) => parts.length >= 2 && parts[0])
    .map((parts) => ({
      status: /** @type {string} */ (parts[0]),
      path: /** @type {string} */ (parts[parts.length - 1]),
    }));
}

/**
 * The local shas of the branches a push sends: git writes one line per ref,
 * `<local ref> <local sha> <remote ref> <remote sha>`. `git push origin HEAD:<branch>` names its local
 * ref `HEAD`, which is a branch push too. Deletions and tags carry nothing to check.
 * @param {string} stdin
 * @returns {string[]}
 */
export function pushedShas(stdin) {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([localRef, localSha]) =>
        (localRef?.startsWith('refs/heads/') || localRef === 'HEAD') &&
        localSha &&
        !ZERO_SHA.test(localSha),
    )
    .map(([, localSha]) => /** @type {string} */ (localSha));
}

/** @param {string[]} args */
function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** @type {Map<string, Workspace | null>} */
const workspaces = new Map();

/**
 * The workspace a repo file belongs to: its nearest folder with a package.json, below the root.
 * `vitest` says whether its `test` script runs vitest.
 * @param {string} file
 * @returns {Workspace | null}
 */
function workspaceOf(file) {
  let dir = path.posix.dirname(file);
  while (dir !== '.' && dir !== '') {
    if (!workspaces.has(dir)) {
      const manifest = path.join(ROOT, dir, 'package.json');
      if (existsSync(manifest)) {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
        workspaces.set(dir, {
          dir,
          name: pkg.name ?? dir,
          vitest: /\bvitest\b/.test(pkg.scripts?.test ?? ''),
        });
      } else workspaces.set(dir, null);
    }
    const ws = workspaces.get(dir);
    if (ws) return ws;
    dir = path.posix.dirname(dir);
  }
  return null;
}

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * A workspace's guard tests, relative to it: the tests at its root and in `app/`,
 * `lib/small-text-contrast.test.ts`, and an api's `src/openapi` tests.
 * @param {string} dir
 * @returns {string[]}
 */
function guardTests(dir) {
  /** @param {string} sub */
  const testsIn = (sub) => {
    const abs = path.join(ROOT, dir, sub);
    if (!existsSync(abs)) return [];
    return readdirSync(abs)
      .filter((name) => TEST_FILE.test(name))
      .map((name) => path.posix.join(sub, name));
  };
  const found = [...testsIn('.'), ...testsIn('app'), ...testsIn('src/openapi')].map((f) =>
    f.replace(/^\.\//, ''),
  );
  if (existsSync(path.join(ROOT, dir, 'lib/small-text-contrast.test.ts')))
    found.push('lib/small-text-contrast.test.ts');
  return found.sort();
}

/** Every product's help app that checks the repo paths its articles cite. */
function helpApps() {
  return readdirSync(ROOT)
    .map((product) => `${product}/apps/help`)
    .filter((dir) => existsSync(path.join(ROOT, dir, 'lib/repo-paths-in-docs.test.ts')))
    .map((dir) => /** @type {Workspace} */ (workspaceOf(`${dir}/package.json`)))
    .filter(Boolean);
}

const SITE = 'liveworkspace/apps/site';

/**
 * The site's metric-emitters test for a product, when there is one.
 * @param {string} product
 */
function emitterTest(product) {
  const file = `app/telemetry/${product}/metric-emitters.test.ts`;
  if (!existsSync(path.join(ROOT, SITE, file))) return null;
  const ws = workspaceOf(`${SITE}/package.json`);
  return ws ? { ws, file } : null;
}

/**
 * The environment the steps run in: `pnpm` on PATH, which turbo needs to find. Where only corepack is
 * installed, its shims go in a folder of their own under the temp directory, made once.
 * @returns {NodeJS.ProcessEnv}
 */
function withPnpm() {
  if (spawnSync('pnpm', ['--version'], { stdio: 'ignore' }).status === 0) return process.env;
  const shims = path.join(tmpdir(), 'liveworkspace-pnpm-shims');
  mkdirSync(shims, { recursive: true });
  execFileSync('corepack', ['enable', '--install-directory', shims, 'pnpm'], { stdio: 'ignore' });
  return { ...process.env, PATH: `${shims}${path.delimiter}${process.env.PATH ?? ''}` };
}

/**
 * Whether a lock left by `pid` is still held: a run that died without cleaning up leaves a stale one.
 * @param {number} pid
 */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * One run at a time on this machine, across every worktree (they share core.hooksPath): parallel runs
 * double the load (several agents pushing at once once took the machine past a load of 70). Returns the
 * release, or null when held.
 * @returns {(() => void) | null}
 */
function tryLock() {
  const lock = path.join(tmpdir(), 'liveworkspace-pre-push.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      mkdirSync(lock);
      writeFileSync(path.join(lock, 'pid'), String(process.pid));
      return () => rmSync(lock, { recursive: true, force: true });
    } catch {
      let pid = 0;
      try {
        pid = Number(readFileSync(path.join(lock, 'pid'), 'utf8'));
      } catch {
        // Made but not yet written: treat as held.
        return null;
      }
      if (alive(pid)) return null;
      rmSync(lock, { recursive: true, force: true });
    }
  }
  return null;
}

const LOCK_WAIT_MS = 15 * 60 * 1000;
const LOCK_POLL_MS = 10 * 1000;

/**
 * Waits its turn: the checks are short now, so a push queues behind another's for up to 15 minutes
 * rather than skipping them. Past that it skips and leaves its checks to CI. Returns the release, or null.
 * @returns {(() => void) | null}
 */
function takeLock() {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let said = false;
  for (;;) {
    const release = tryLock();
    if (release || Date.now() >= deadline) return release;
    if (!said) {
      console.log('[pre-push] waiting: another push is running its checks on this machine');
      said = true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_POLL_MS);
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun) {
    const shas = pushedShas(readFileSync(0, 'utf8'));
    if (shas.length === 0) {
      console.log('[pre-push] nothing to check: the push sends no branch commits');
      return 0;
    }
    const head = git('rev-parse', 'HEAD');
    const others = shas.filter((sha) => sha !== head);
    if (others.length > 0) {
      console.log(
        `[pre-push] skipped: the push sends ${others.map((s) => s.slice(0, 9)).join(', ')}, not the checked-out HEAD; CI checks it`,
      );
      return 0;
    }
  }
  let base;
  try {
    base = git('merge-base', 'HEAD', BASE_REF);
  } catch {
    console.error(`[pre-push] failed: no merge base with ${BASE_REF}; run \`git fetch origin\``);
    return 1;
  }
  if (base === git('rev-parse', 'HEAD')) {
    console.log(`[pre-push] nothing changed since ${BASE_REF} (${base.slice(0, 9)})`);
    return 0;
  }
  const env = withPnpm();
  const plan = JSON.parse(
    execFileSync('node', ['.github/scripts/ci-plan.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...env, BASE: base, HEAD: 'HEAD', TURBO_CMD: 'pnpm exec turbo' },
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  );
  const changes = parseNameStatus(git('diff', '--name-status', '-M', base, 'HEAD'));
  // Half the cores busy already: cap each test run, so a starved CPU doesn't fail timing tests.
  const busy = loadavg()[0] >= availableParallelism() / 2;
  const install = installStep(plan, changes, {
    workspaceOf,
    hasModules: (dir) => existsSync(path.join(ROOT, dir, 'node_modules')),
  });
  const steps = [
    ...(install ? [install] : []),
    ...prePushSteps(plan),
    ...testSteps(changes, {
      workspaceOf,
      guardTests,
      helpApps,
      emitterTest,
      maxWorkers: busy ? 2 : undefined,
    }),
  ];
  if (steps.length === 0) {
    console.log('[pre-push] the change reaches no workspace');
    return 0;
  }
  if (dryRun) {
    for (const step of steps) console.log(`${step.label}: ${step.cmd} ${step.args.join(' ')}`);
    return 0;
  }
  const release = takeLock();
  if (!release) {
    console.log(
      '[pre-push] skipped: another push held the checks for 15 minutes; CI checks this one',
    );
    return 0;
  }
  try {
    return runSteps(steps, env);
  } finally {
    release();
  }
}

/**
 * @param {Step[]} steps
 * @param {NodeJS.ProcessEnv} env
 */
function runSteps(steps, env) {
  const started = Date.now();
  for (const step of steps) {
    console.log(`[pre-push] ${step.label}`);
    const run = spawnSync(step.cmd, step.args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...env, TURBO_TELEMETRY_DISABLED: '1', ...step.env },
    });
    if (run.status !== 0) {
      console.error(`[pre-push] failed: ${step.label} (exit ${run.status ?? run.signal})`);
      console.error('[pre-push] fix it, or push with --no-verify to leave it to CI');
      return 1;
    }
  }
  console.log(`[pre-push] passed in ${Math.round((Date.now() - started) / 1000)} s`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
