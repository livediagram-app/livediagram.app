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
//   WORKERS=<the tier's plan entries as JSON> GROUP=<group> ENVIRONMENT=staging|production REF=<sha> \
//     node .github/scripts/deploy-group.mjs
//
// It never prints a var's value: hosted build vars and `--var` flags are passed, never logged.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Each tier's job name, before its group's. */
export const TIER_LABELS = ['Services and apis', 'Sites', 'Routers'];

/** The sites deploy in a job per product; the services and apis, and the routers, in one job each. */
export function groupOf(worker) {
  return worker.tier === 1 ? worker.product : 'all';
}

// A group job's limit, sized from the per-Worker step times measured on 2026-11-04 (docs/ci.md):
// a site's build and deploy took up to 3.6 minutes (a marketing site), any other Worker's steps up
// to half a minute, and a job's checkout and install about one.
export const MINUTES = { job: 10, build: 6, other: 2, command: 15 };

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
    entry.timeout += worker.build ? MINUTES.build : MINUTES.other;
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
    if (hasHosted && environment === 'staging') {
      extraEnv.NEXT_PUBLIC_MCP_ORIGIN = `https://${worker.product}-mcp-staging.liveworkspace-easing509.workers.dev`;
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

/** The real runner: output streams to the log, except a capture, which is returned. */
export function spawnExec(cmd, args, { cwd, env, capture }) {
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

/** Runs one step; true when it succeeded. Logs the command, never a captured var or flag. */
export function runStep(step, { exec, baseEnv, log }) {
  let env = { ...baseEnv, ...step.env };
  let args = step.args;
  if (step.envFrom) {
    const got = exec(step.envFrom.cmd, step.envFrom.args, {
      cwd: step.envFrom.cwd,
      env,
      capture: true,
    });
    if (got.status !== 0) return false;
    env = { ...env, ...parseEnvLines(got.stdout) };
  }
  if (step.argsFrom) {
    const got = exec(step.argsFrom.cmd, step.argsFrom.args, {
      cwd: step.argsFrom.cwd,
      env,
      capture: true,
    });
    if (got.status !== 0) return false;
    args = [...args, ...lines(got.stdout), ...step.argsFrom.append];
  }
  const extra = step.argsFrom ? ' (plus its hosted vars)' : '';
  log(`[deploy-group] ${step.name}: ${step.cmd} ${step.args.join(' ')}${extra} in ${step.cwd}`);
  return exec(step.cmd, args, { cwd: step.cwd, env, capture: false }).status === 0;
}

/**
 * Deploys each Worker in turn, every one of them whatever the others did. Returns each Worker's
 * result: `failed` is the step it stopped at, or empty.
 */
export function deployGroup(
  workers,
  { environment, ref, exec, log, baseEnv = {}, now = Date.now, exists },
) {
  const results = [];
  for (const worker of workers) {
    const started = now();
    log(`::group::${worker.name}`);
    let failed = '';
    const steps = workerSteps(worker, { environment, ref, exists });
    for (const step of steps) {
      if (!runStep(step, { exec, baseEnv, log })) {
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
      steps: steps.map((s) => s.name),
      seconds: Math.round((now() - started) / 1000),
    });
  }
  return results;
}

/** The job summary: every Worker with its result, the step it failed at, and its time. */
export function renderSummary(label, environment, results) {
  const failed = results.filter((r) => r.failed).length;
  const rows = results.map((r) => {
    const result = r.failed ? `Failed at ${r.failed}` : 'Deployed';
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
