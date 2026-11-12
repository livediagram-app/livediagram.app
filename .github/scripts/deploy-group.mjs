// Deploys a group of Workers in one job (docs/ci.md "Deploys", "Jobs").
//
// The deploy plan (ci-plan.mjs, PLAN_MODE=deploy) puts each Worker in a group: the services and apis
// in one, the sites in one per product, the routers in one. deploy-group.yml runs one job per group,
// which checks out and installs once and then runs this script, deploying the group's Workers one
// after another. Each Worker's steps are the ones it had as a job of its own: its build when it
// serves one (a static site's `out/`), its D1 migrations when it has a database, `wrangler deploy`,
// and for a product api its hosted vars, checked on the live deployment afterwards.
//
// A Worker whose step fails stops there, so a failing migration never deploys the code after it, and
// the group goes on with the rest: one bad Worker never hides another. The script exits 1 at the end
// when any Worker failed. Each Worker's output is a log group of its own, and the job summary lists
// every Worker's result.
//
// The `wrangler deploy` step alone retries, up to twice more after 30s and then 120s, and only when
// its output shows a transient Cloudflare API failure (a 5xx answer, or wrangler's own retries giving
// up with code -1). Wrangler retries within seconds, inside the same blip; a production deploy failed
// that way twice on 2026-11-12. Any other failure fails at once, and D1 migrations never retry.
//
//   WORKERS=<the tier's plan entries as JSON> GROUP=<group> ENVIRONMENT=staging|production REF=<sha> \
//     node .github/scripts/deploy-group.mjs
//
// It never prints a var's value: hosted build vars and `--var` flags are passed, never logged.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Each tier's job name, before its group's. */
export const TIER_LABELS = ['Services and apis', 'Sites', 'Routers'];

/** The sites deploy in a job per product; the services and apis, and the routers, in one job each. */
export function groupOf(worker) {
  return worker.tier === 1 ? worker.product : 'all';
}

// A group job's limit, sized from the per-Worker step times measured on 2026-11-04 (docs/ci.md):
// a site's build and deploy took up to 3.6 minutes (a marketing site), any other Worker's steps up
// to half a minute, and a job's checkout and install about one. `retry` is each Worker's room for its
// deploy's retries: 2.5 minutes of waits plus two more attempts, at worst every Worker in the group.
export const MINUTES = { job: 10, build: 6, other: 2, retry: 4, command: 15 };

/** The waits, in seconds, before a deploy's second and third attempts. */
export const RETRY_WAITS = [30, 120];

/** The tier's groups, in plan order, for deploy.yml's matrix: one job each. */
export function deployGroups(deploys, tier) {
  const groups = new Map();
  for (const worker of deploys.filter((d) => d.tier === tier)) {
    const group = worker.group ?? groupOf(worker);
    const entry = groups.get(group) ?? {
      group,
      label: group === 'all' ? TIER_LABELS[tier] : `${TIER_LABELS[tier]} (${group})`,
      workers: [],
      history: false,
      timeout: MINUTES.job,
    };
    entry.workers.push(worker.name);
    entry.history ||= Boolean(worker.history);
    entry.timeout += (worker.build ? MINUTES.build : MINUTES.other) + MINUTES.retry;
    groups.set(group, entry);
  }
  return [...groups.values()].map(({ workers, ...rest }) => ({
    ...rest,
    count: workers.length,
    workers: workers.join(', '),
  }));
}

/** wrangler's `--env`: staging's `[env.staging]` blocks; production is the top-level config. */
const envFlag = (environment) => (environment === 'staging' ? ['--env', 'staging'] : []);

/**
 * One Worker's steps, in order. A step runs `cmd args` in `cwd`; `envFrom` first runs a command whose
 * output lines (`NAME=value`) join its environment, and `argsFrom` one whose output lines join its
 * arguments, followed by `append`.
 */
export function workerSteps(worker, { environment, ref, exists = existsSync }) {
  const env = envFlag(environment);
  const steps = [];
  if (worker.build) {
    const hosted = `${worker.product}/apps/api/scripts/hosted-vars.mjs`;
    const extraEnv = { NEXT_PUBLIC_BUILD_ID: ref };
    const hasHosted = exists(hosted);
    // Staging's sites name the staging mcp worker by its custom domain: no product Worker has a
    // workers.dev address (each wrangler.toml sets workers_dev = false). A product with no mcp worker
    // keeps the default.
    if (
      hasHosted &&
      environment === 'staging' &&
      exists(`${worker.product}/apps/mcp/wrangler.toml`)
    ) {
      extraEnv.NEXT_PUBLIC_MCP_ORIGIN = `https://mcp-staging.${worker.product}.app`;
    }
    steps.push({
      name: 'Build',
      cwd: '.',
      cmd: 'pnpm',
      args: ['turbo', 'run', 'build', `--filter=${worker.name}`],
      env: extraEnv,
      ...(hasHosted && {
        envFrom: {
          cwd: `${worker.product}/apps/api`,
          cmd: 'node',
          args: ['scripts/hosted-vars.mjs', 'build-env', ...env],
        },
      }),
    });
  }
  if (worker.d1) {
    steps.push({
      name: 'Apply D1 migrations',
      cwd: worker.dir,
      cmd: 'pnpm',
      args: ['exec', 'wrangler', 'd1', 'migrations', 'apply', worker.d1, '--remote', ...env],
    });
  }
  steps.push({
    name: 'Deploy',
    cwd: worker.dir,
    cmd: 'pnpm',
    args: ['exec', 'wrangler', 'deploy', ...env],
    retry: true,
    ...(worker.hosted && {
      argsFrom: {
        cwd: worker.dir,
        cmd: 'node',
        args: ['scripts/hosted-vars.mjs', 'flags', ...env],
        append: ['--var', `BUILD_ID:${ref}`],
      },
    }),
  });
  if (worker.hosted) {
    steps.push({
      name: 'Verify hosted vars are live',
      cwd: worker.dir,
      cmd: 'node',
      args: ['scripts/hosted-vars.mjs', 'verify', ...env],
    });
  }
  return steps;
}

const lines = (text) => text.split('\n').filter((line) => line !== '');

/** `NAME=value` lines to an environment, split on the first `=`. */
export function parseEnvLines(text) {
  const env = {};
  for (const line of lines(text)) {
    const at = line.indexOf('=');
    if (at > 0) env[line.slice(0, at)] = line.slice(at + 1);
  }
  return env;
}

// wrangler colours its errors, splitting `[ERROR]` with escape codes.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const API_5XX = /-> 5\d\d\b/;
const NOT_TRANSIENT = /\[code: 10000\]|Authentication error|-> 40[13]\b/;

/**
 * True when a failed `wrangler deploy` printed a transient Cloudflare API failure, worth retrying:
 * a malformed answer with a 5xx status, a request to the API that failed with code -1 (wrangler's own
 * retries gave up) or a 5xx, or a gateway error (502, 503, 504, 524) on an API request. Never an auth
 * error, and never anything else (validation, build, config).
 */
export function isTransientCloudflareError(output) {
  const text = output.replace(ANSI, '');
  if (NOT_TRANSIENT.test(text)) return false;
  if (/Received a malformed response from the API/.test(text) && API_5XX.test(text)) return true;
  if (/A request to the Cloudflare API \(.*\) failed/.test(text)) {
    if (/\[code: -1\]/.test(text) || API_5XX.test(text)) return true;
  }
  return /\/accounts\/\S+ -> (?:502|503|504|524)\b/.test(text);
}

/** Blocks for `seconds`: the script runs its steps one after another, so nothing else waits. */
export function sleepSync(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

/**
 * The real runner: output streams to the log, except a capture, which is returned. A `tee` streams
 * it too (stdout and stderr together, through `tee`) and also returns it, to classify a failure.
 */
export function spawnExec(cmd, args, { cwd, env, capture, tee }) {
  if (tee) {
    const dir = mkdtempSync(join(tmpdir(), 'deploy-group-'));
    const file = join(dir, 'output.log');
    try {
      // The command and its arguments go in as positional parameters, never into the script text.
      const run = spawnExec(
        'bash',
        ['-o', 'pipefail', '-c', '"$@" 2>&1 | tee "$DEPLOY_GROUP_LOG"', 'bash', cmd, ...args],
        { cwd, env: { ...env, DEPLOY_GROUP_LOG: file }, capture: false },
      );
      return { status: run.status, stdout: existsSync(file) ? readFileSync(file, 'utf8') : '' };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    timeout: MINUTES.command * 60_000,
  });
  if (result.error) console.error(`[deploy-group] ${cmd}: ${result.error.message}`);
  return { status: result.error ? 1 : (result.status ?? 1), stdout: result.stdout ?? '' };
}

/**
 * Runs one step: `ok` when it succeeded, and how many times it retried. Logs the command, never a
 * captured var or flag. A `retry` step runs again after each of RETRY_WAITS while its output shows a
 * transient Cloudflare API failure.
 */
export function runStep(step, { exec, baseEnv, log, sleep = sleepSync }) {
  let env = { ...baseEnv, ...step.env };
  let args = step.args;
  if (step.envFrom) {
    const got = exec(step.envFrom.cmd, step.envFrom.args, {
      cwd: step.envFrom.cwd,
      env,
      capture: true,
    });
    if (got.status !== 0) return { ok: false, retries: 0 };
    env = { ...env, ...parseEnvLines(got.stdout) };
  }
  if (step.argsFrom) {
    const got = exec(step.argsFrom.cmd, step.argsFrom.args, {
      cwd: step.argsFrom.cwd,
      env,
      capture: true,
    });
    if (got.status !== 0) return { ok: false, retries: 0 };
    args = [...args, ...lines(got.stdout), ...step.argsFrom.append];
  }
  const extra = step.argsFrom ? ' (plus its hosted vars)' : '';
  log(`[deploy-group] ${step.name}: ${step.cmd} ${step.args.join(' ')}${extra} in ${step.cwd}`);
  const attempts = step.retry ? RETRY_WAITS.length + 1 : 1;
  for (let attempt = 1; ; attempt++) {
    const run = exec(step.cmd, args, {
      cwd: step.cwd,
      env,
      capture: false,
      tee: Boolean(step.retry),
    });
    if (run.status === 0) return { ok: true, retries: attempt - 1 };
    if (attempt === attempts || !isTransientCloudflareError(run.stdout)) {
      return { ok: false, retries: attempt - 1 };
    }
    const wait = RETRY_WAITS[attempt - 1];
    log(
      `::warning title=${step.name} retrying::Cloudflare API error, retrying in ${wait}s (attempt ${attempt + 1} of ${attempts})`,
    );
    sleep(wait);
  }
}

/**
 * Deploys each Worker in turn, every one of them whatever the others did. Returns each Worker's
 * result: `failed` is the step it stopped at, or empty.
 */
export function deployGroup(
  workers,
  { environment, ref, exec, log, baseEnv = {}, now = Date.now, exists, sleep },
) {
  const results = [];
  for (const worker of workers) {
    const started = now();
    log(`::group::${worker.name}`);
    let failed = '';
    let retries = 0;
    const steps = workerSteps(worker, { environment, ref, exists });
    for (const step of steps) {
      const run = runStep(step, { exec, baseEnv, log, sleep });
      retries += run.retries;
      if (!run.ok) {
        failed = step.name;
        break;
      }
    }
    log('::endgroup::');
    if (failed)
      log(`::error title=${worker.name} did not deploy::${failed} failed; see its log group`);
    results.push({
      name: worker.name,
      failed,
      retries,
      steps: steps.map((s) => s.name),
      seconds: Math.round((now() - started) / 1000),
    });
  }
  return results;
}

const retried = (n) => (n ? ` after ${n} ${n === 1 ? 'retry' : 'retries'}` : '');

/**
 * The job summary: every Worker with its result, the step it failed at, any retries after a
 * Cloudflare API error, and its time.
 */
export function renderSummary(label, environment, results) {
  const failed = results.filter((r) => r.failed).length;
  const rows = results.map((r) => {
    const result = (r.failed ? `Failed at ${r.failed}` : 'Deployed') + retried(r.retries);
    return `| \`${r.name}\` | ${result} | ${r.steps.join(', ')} | ${r.seconds}s |`;
  });
  return [
    `### ${label}: ${environment}`,
    '',
    failed
      ? `${failed} of ${results.length} Workers failed; the others deployed. Re-running this job redeploys all of them, which is safe.`
      : `All ${results.length} Workers deployed.`,
    '',
    '| Worker | Result | Steps | Time |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export function main(env = process.env, exec = spawnExec) {
  const { WORKERS, GROUP, ENVIRONMENT, REF, LABEL } = env;
  if (!WORKERS || !GROUP || !ENVIRONMENT || !REF) {
    console.error(
      'usage: WORKERS=<json> GROUP=<group> ENVIRONMENT=<env> REF=<sha> deploy-group.mjs',
    );
    return 2;
  }
  const workers = JSON.parse(WORKERS).filter((w) => (w.group ?? groupOf(w)) === GROUP);
  if (workers.length === 0) {
    console.error(`::error::No Worker in group ${GROUP}; the plan and the job disagree`);
    return 1;
  }
  const label = LABEL || GROUP;
  console.log(`[deploy-group] ${label}: ${workers.map((w) => w.name).join(', ')}`);
  const results = deployGroup(workers, {
    environment: ENVIRONMENT,
    ref: REF,
    exec,
    log: (line) => console.log(line),
    baseEnv: env,
  });
  const summary = renderSummary(label, ENVIRONMENT, results);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  else console.log(summary);
  return results.some((r) => r.failed) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
