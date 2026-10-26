// The pre-push hook (docs/ci.md "Before a push"): runs what CI's Checks and Tests jobs would fail on,
// for what the push changes since its merge base with origin/main, so a deterministic failure surfaces
// on the machine first. It asks CI's own planner (.github/scripts/ci-plan.mjs) which product groups
// the change reaches and runs each group's steps as ci.yml does. CI still runs everything, E2E included.
//
//   .githooks/pre-push -> node scripts/git-hooks/pre-push.mjs (the push's refs on stdin)
//   node scripts/git-hooks/pre-push.mjs --dry-run   prints the steps for HEAD without running them

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_REF = 'origin/main';
const ZERO_SHA = /^0+$/;

/** @typedef {{ label: string, cmd: string, args: string[], env?: Record<string, string> }} Step */
/**
 * @typedef {{ group: string, filters: string, coverage: string, plain: string, format: string, base: string }} Group
 * @typedef {{ group: string, editor: string }} EditorShard
 */

/** `--filter=a --filter=b` as ci-plan writes it, back into arguments. */
const split = (/** @type {string} */ filters) => filters.split(' ').filter(Boolean);

/**
 * The checks for a push, in the order they run, from ci-plan's groups: per group what ci.yml's
 * Checks and Tests run, and each reached editor's suite once (CI shards it three ways under coverage).
 * Two turbo tasks at a time, as on CI: each vitest fills the cores.
 * @param {{ groups: Group[], editors: EditorShard[] }} plan
 * @returns {Step[]}
 */
export function prePushSteps({ groups, editors }) {
  /** @type {Step[]} */
  const steps = [];
  const turbo = (/** @type {string[]} */ ...args) => [
    'exec',
    'turbo',
    'run',
    ...args,
    '--continue',
    '--concurrency=2',
  ];
  for (const g of groups) {
    steps.push(
      {
        label: `${g.group}: lint and typecheck`,
        cmd: 'pnpm',
        args: turbo('lint', 'typecheck', ...split(g.filters)),
      },
      {
        label: `${g.group}: format`,
        cmd: 'bash',
        args: ['.github/scripts/format-check.sh'],
        env: { BASE: g.base, PRODUCT: g.format },
      },
    );
    if (g.plain)
      steps.push({
        label: `${g.group}: tests`,
        cmd: 'pnpm',
        args: turbo('test', ...split(g.plain)),
      });
    if (g.coverage) {
      steps.push({
        label: `${g.group}: tests with coverage thresholds`,
        cmd: 'pnpm',
        args: turbo('test:coverage', ...split(g.coverage)),
      });
    }
  }
  for (const editor of new Set(editors.map((e) => e.editor))) {
    steps.push({
      label: `${editor}: unit tests`,
      cmd: 'pnpm',
      args: ['--filter', editor, 'exec', 'vitest', 'run'],
    });
  }
  return steps;
}

/**
 * The local shas of the branches a push sends: git writes one line per ref,
 * `<local ref> <local sha> <remote ref> <remote sha>`. Deletions and tags carry nothing to check.
 * @param {string} stdin
 * @returns {string[]}
 */
export function pushedShas(stdin) {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([localRef, localSha]) =>
        localRef?.startsWith('refs/heads/') && localSha && !ZERO_SHA.test(localSha),
    )
    .map(([, localSha]) => /** @type {string} */ (localSha));
}

/** @param {string[]} args */
function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
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
 * One run at a time on this machine, across every worktree (they share core.hooksPath): a second push
 * while one's checks run would double the load (several agents pushing at once once took the machine
 * past a load of 70), so it skips and leaves its checks to CI. Returns the release, or null when held.
 * @returns {(() => void) | null}
 */
function takeLock() {
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
  const steps = prePushSteps(plan);
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
      '[pre-push] skipped: another push is running its checks on this machine; CI checks this one',
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
