// The pre-push hook's runner (docs/ci.md "Before a push"; the plan is pre-push.mjs): asks vitest what each
// changed workspace's change reaches, then runs the steps, the checks in order and the test runs a few at a
// time, and reports every failing step at the end.

import { execFile, spawn, spawnSync } from 'node:child_process';

/**
 * @typedef {import('./pre-push.mjs').Step} Step
 * @typedef {import('./pre-push.mjs').Workspace} Workspace
 * @typedef {import('./pre-push.mjs').Reach} Reach
 */

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * The test files in `vitest list --filesOnly` output: one path a line, anything else it printed dropped.
 * @param {string} text
 * @returns {string[]}
 */
export function listedTests(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => TEST_FILE.test(line) && !/\s/.test(line));
}

/** How many workspaces are asked what their change reaches at once: each is a short, mostly idle process. */
const REACH_POOL = 4;

/**
 * Runs `tasks` with at most `limit` going at once, in order.
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
export async function pooled(tasks, limit) {
  /** @type {T[]} */
  const results = Array.from({ length: tasks.length });
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await /** @type {() => Promise<T>} */ (tasks[index])();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  return results;
}

/**
 * What vitest says each workspace's change reaches: `vitest list --filesOnly --changed <base>` over all of
 * its test files. Null for a workspace it could not answer for (no modules, an old vitest), which then runs
 * what `related` finds, uncapped.
 * @param {string} root  the repository's root
 * @param {{ ws: Workspace }[]} touched
 * @param {string} base
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<Map<string, Reach | null>>}
 */
export async function reachOf(root, touched, base, env) {
  /** @param {Workspace} ws @param {string[]} extra @returns {Promise<string[] | null>} */
  const list = (ws, extra) =>
    new Promise((resolve) => {
      execFile(
        'pnpm',
        ['--filter', ws.name, 'exec', 'vitest', 'list', '--filesOnly', ...extra],
        { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60_000 },
        (error, stdout) => resolve(error ? null : listedTests(stdout)),
      );
    });
  const answers = await pooled(
    touched.map(({ ws }) => async () => {
      const [related, all] = await Promise.all([list(ws, ['--changed', base]), list(ws, [])]);
      return /** @type {[string, Reach | null]} */ ([
        ws.dir,
        related && all && all.length > 0 ? { related, total: all.length } : null,
      ]);
    }),
    REACH_POOL,
  );
  return new Map(answers);
}

/**
 * One step, its output kept until it ends so steps running side by side never interleave.
 * @param {string} root
 * @param {Step} step
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<{ status: number | string, output: string, ms: number }>}
 */
function runQuietly(root, step, env) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(step.cmd, step.args, {
      cwd: root,
      env: { ...env, TURBO_TELEMETRY_DISABLED: '1', ...step.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', (error) =>
      resolve({ status: 'error', output: `${output}${error.message}\n`, ms: Date.now() - started }),
    );
    child.on('close', (code, signal) =>
      resolve({ status: code ?? signal ?? 'error', output, ms: Date.now() - started }),
    );
  });
}

/** Where a run says what happened: the console, a failing test run's own output written as it came. */
const CONSOLE = {
  log: (/** @type {string} */ line) => console.log(line),
  error: (/** @type {string} */ line) => console.error(line),
  write: (/** @type {string} */ text) => void process.stdout.write(text),
};

const seconds = (/** @type {number} */ ms) => `${Math.round(ms / 1000)} s`;

/**
 * Runs the steps: the checks in order, then the test runs `pool` at a time. A failing step never ends the
 * run (but for an install, which nothing can pass without): every failure is listed at the end, so one
 * push shows all there is to fix.
 * @param {string} root
 * @param {Step[]} steps
 * @param {NodeJS.ProcessEnv} env
 * @param {number} pool
 * @param {typeof CONSOLE} [io]  where it says what happened (the tests pass their own)
 */
export async function runSteps(root, steps, env, pool, io = CONSOLE) {
  const started = Date.now();
  /** @type {string[]} */
  const failed = [];
  const fail = (/** @type {Step} */ step, /** @type {number | string | null} */ status) => {
    failed.push(step.label);
    io.error(`[pre-push] failed: ${step.label} (exit ${status})`);
  };
  let stopped = false;
  for (const step of steps.filter((s) => !s.parallel)) {
    if (step.skip) {
      io.log(`[pre-push] skipped: ${step.label}`);
      continue;
    }
    io.log(`[pre-push] ${step.label}`);
    const run = spawnSync(step.cmd, step.args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...env, TURBO_TELEMETRY_DISABLED: '1', ...step.env },
    });
    if (run.status === 0) continue;
    fail(step, run.status ?? run.signal);
    if (step.stop) {
      stopped = true;
      break;
    }
  }
  const tests = stopped ? [] : steps.filter((s) => s.parallel);
  if (tests.length > 0) io.log(`[pre-push] ${tests.length} test runs, ${pool} at a time`);
  await pooled(
    tests.map((step) => async () => {
      const run = await runQuietly(root, step, env);
      if (run.status === 0) {
        io.log(`[pre-push] passed in ${seconds(run.ms)}: ${step.label}`);
        return;
      }
      io.write(run.output);
      fail(step, run.status);
    }),
    pool,
  );
  if (failed.length > 0) {
    io.error(`[pre-push] ${failed.length} failed in ${seconds(Date.now() - started)}:`);
    for (const label of failed) io.error(`[pre-push]   ${label}`);
    io.error('[pre-push] fix them, or push with --no-verify to leave it to CI');
    return 1;
  }
  io.log(`[pre-push] passed in ${seconds(Date.now() - started)}`);
  return 0;
}
