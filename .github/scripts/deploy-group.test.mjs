import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MINUTES,
  RETRY_WAITS,
  TIMED_OUT,
  deployGroup,
  deployGroups,
  groupOf,
  isTransientCloudflareError,
  main,
  parseEnvLines,
  renderSummary,
  runStep,
  sleepSync,
  spawnExec,
  workerSteps,
} from './deploy-group.mjs';

const REF = 'abc123';

// The shape ci-plan.mjs gives each Worker (deployOf).
function worker(name, dir, tier, extra = {}) {
  const product = dir.split('/')[0];
  return {
    name,
    dir,
    product,
    tier,
    group: groupOf({ tier, product }),
    d1: '',
    build: false,
    history: false,
    hosted: '',
    ...extra,
  };
}

// Every Worker, as `all` plans them: five products and the platform.
const PRODUCTS = ['livedesign', 'livediagram', 'livedocuments', 'livehuddle', 'liveplanner'];
const EVERY = [
  ...PRODUCTS.flatMap((p) => [
    worker(`@${p}/api`, `${p}/apps/api`, 0, { hosted: p }),
    worker(`@${p}/editor`, `${p}/apps/editor`, 1, { build: true }),
    worker(`@${p}/help`, `${p}/apps/help`, 1, { build: true, history: true }),
    worker(`@${p}/marketing`, `${p}/apps/marketing`, 1, { build: true }),
    worker(`@${p}/mcp`, `${p}/apps/mcp`, 1),
    worker(`@${p}/router`, `${p}/apps/router`, 2),
  ]),
  worker('@liveworkspace/accounts', 'liveworkspace/apps/accounts', 1, { d1: 'DB' }),
  worker('@liveworkspace/site', 'liveworkspace/apps/site', 1, { build: true }),
  worker('@liveworkspace/redirect', 'liveworkspace/apps/redirect', 2),
  ...['community', 'drive', 'export', 'index', 'media', 'status', 'telemetry'].map((s) =>
    worker(`@liveworkspace/${s}-service`, `liveworkspace/apps/${s}`, 0, {
      d1: ['drive', 'export'].includes(s) ? '' : 'DB',
    }),
  ),
];

test('sites group by product; services and apis, and routers, are one job each', () => {
  assert.equal(groupOf({ tier: 0, product: 'livediagram' }), 'all');
  assert.equal(groupOf({ tier: 1, product: 'livediagram' }), 'livediagram');
  assert.equal(groupOf({ tier: 2, product: 'liveworkspace' }), 'all');

  const [services] = [deployGroups(EVERY, 0)];
  assert.equal(services.length, 1);
  assert.deepEqual(
    { ...services[0], workers: undefined },
    {
      group: 'all',
      label: 'Services and apis',
      count: 12,
      history: false,
      timeout: 10 + 12 * (2 + 4),
      workers: undefined,
    },
  );

  const sites = deployGroups(EVERY, 1);
  assert.deepEqual(
    sites.map((g) => [g.label, g.count, g.history, g.timeout]),
    [
      ...PRODUCTS.map((p) => [`Sites (${p})`, 4, true, 10 + 3 * 6 + 2 + 4 * 4]),
      ['Sites (liveworkspace)', 2, false, 10 + 6 + 2 + 2 * 4],
    ],
  );
  assert.equal(
    sites[1].workers,
    '@livediagram/editor, @livediagram/help, @livediagram/marketing, @livediagram/mcp',
  );

  const routers = deployGroups(EVERY, 2);
  assert.deepEqual(
    routers.map((g) => [g.label, g.count, g.timeout]),
    [['Routers', 6, 10 + 6 * (2 + 4)]],
  );

  // About 40 jobs become 8, and every Worker is in exactly one.
  const all = [0, 1, 2].flatMap((t) => deployGroups(EVERY, t));
  assert.equal(all.length, 8);
  assert.equal(
    all.reduce((n, g) => n + g.count, 0),
    EVERY.length,
  );
});

test('a realistic change: one product and a shared service plan only their own groups', () => {
  const change = EVERY.filter(
    (w) => w.product === 'liveplanner' || w.name === '@liveworkspace/telemetry-service',
  );
  assert.deepEqual(
    deployGroups(change, 0).map((g) => [g.label, g.workers]),
    [['Services and apis', '@liveplanner/api, @liveworkspace/telemetry-service']],
  );
  assert.deepEqual(
    deployGroups(change, 1).map((g) => g.label),
    ['Sites (liveplanner)'],
  );
  assert.deepEqual(
    deployGroups(change, 2).map((g) => g.label),
    ['Routers'],
  );
  // A Worker the plan left out is in no group: nothing changed, nothing deploys.
  assert.deepEqual(deployGroups([], 1), []);
  // An entry without a group (an older plan) is grouped the same way.
  const { group, ...ungrouped } = change.find((w) => w.tier === 1);
  assert.equal(group, 'liveplanner');
  assert.equal(deployGroups([ungrouped], 1)[0].group, 'liveplanner');
});

test("a site's steps: its build with the build id and hosted build vars, then deploy", () => {
  const site = EVERY.find((w) => w.name === '@livediagram/editor');
  const staging = workerSteps(site, { environment: 'staging', ref: REF, exists: () => true });
  assert.deepEqual(
    staging.map((s) => s.name),
    ['Build', 'Deploy'],
  );
  assert.deepEqual(staging[0], {
    name: 'Build',
    cwd: '.',
    cmd: 'pnpm',
    args: ['turbo', 'run', 'build', '--filter=@livediagram/editor'],
    env: {
      NEXT_PUBLIC_BUILD_ID: REF,
      NEXT_PUBLIC_MCP_ORIGIN: 'https://mcp-staging.livediagram.app',
    },
    envFrom: {
      cwd: 'livediagram/apps/api',
      cmd: 'node',
      args: ['scripts/hosted-vars.mjs', 'build-env', '--env', 'staging'],
    },
  });
  assert.deepEqual(staging[1], {
    name: 'Deploy',
    cwd: 'livediagram/apps/editor',
    cmd: 'pnpm',
    args: ['exec', 'wrangler', 'deploy', '--env', 'staging'],
    retry: true,
  });

  // Production: the top-level config, and no staging MCP origin.
  const production = workerSteps(site, { environment: 'production', ref: REF, exists: () => true });
  assert.deepEqual(production[0].env, { NEXT_PUBLIC_BUILD_ID: REF });
  assert.deepEqual(production[0].envFrom.args, ['scripts/hosted-vars.mjs', 'build-env']);
  assert.deepEqual(production[1].args, ['exec', 'wrangler', 'deploy']);

  // A product without hosted vars (the platform's site) builds with its build id alone.
  const platform = EVERY.find((w) => w.name === '@liveworkspace/site');
  const [build] = workerSteps(platform, { environment: 'staging', ref: REF, exists: () => false });
  assert.deepEqual(build.env, { NEXT_PUBLIC_BUILD_ID: REF });
  assert.equal(build.envFrom, undefined);

  // A product with hosted vars but no mcp worker (livehuddle) names no staging MCP origin.
  const huddle = EVERY.find((w) => w.name === '@livehuddle/editor');
  const [huddleBuild] = workerSteps(huddle, {
    environment: 'staging',
    ref: REF,
    exists: (path) => !path.endsWith('/apps/mcp/wrangler.toml'),
  });
  assert.deepEqual(huddleBuild.env, { NEXT_PUBLIC_BUILD_ID: REF });
});

test("an api's steps: deploy with its hosted vars and build id, then verify them live", () => {
  const api = EVERY.find((w) => w.name === '@liveplanner/api');
  const steps = workerSteps(api, { environment: 'staging', ref: REF });
  assert.deepEqual(
    steps.map((s) => s.name),
    ['Deploy', 'Verify hosted vars are live'],
  );
  assert.deepEqual(steps[0].argsFrom, {
    cwd: 'liveplanner/apps/api',
    cmd: 'node',
    args: ['scripts/hosted-vars.mjs', 'flags', '--env', 'staging'],
    append: ['--var', `BUILD_ID:${REF}`],
  });
  assert.deepEqual(steps[1].args, ['scripts/hosted-vars.mjs', 'verify', '--env', 'staging']);
});

test('a service with D1 applies its migrations before its code', () => {
  const service = EVERY.find((w) => w.name === '@liveworkspace/telemetry-service');
  const steps = workerSteps(service, { environment: 'production', ref: REF });
  assert.deepEqual(
    steps.map((s) => [s.name, s.cwd, s.args.join(' ')]),
    [
      [
        'Apply D1 migrations',
        'liveworkspace/apps/telemetry',
        'exec wrangler d1 migrations apply DB --remote',
      ],
      ['Deploy', 'liveworkspace/apps/telemetry', 'exec wrangler deploy'],
    ],
  );
});

test('env lines split on the first equals sign; blank and malformed lines are dropped', () => {
  assert.deepEqual(parseEnvLines('A=1\n\nB=x=y\nnoequals\n=bad\n'), { A: '1', B: 'x=y' });
});

// A fake runner: records each call, answers captures from `outputs`, fails the commands in `failing`.
function fakeExec({ outputs = {}, failing = [] } = {}) {
  const calls = [];
  const exec = (cmd, args, opts) => {
    const line = `${cmd} ${args.join(' ')}`;
    calls.push({ line, ...opts });
    const status = failing.some((f) => line.includes(f)) ? 1 : 0;
    const key = Object.keys(outputs).find((k) => line.includes(k));
    return { status, stdout: key ? outputs[key] : '' };
  };
  return { exec, calls };
}

test('a step takes its captured env and args, and never logs their values', () => {
  const { exec, calls } = fakeExec({
    outputs: {
      'build-env': 'NEXT_PUBLIC_TELEMETRY_URL=https://secret.example\n',
      flags: '--var\nTELEMETRY_URL:https://secret.example\n',
    },
  });
  const logged = [];
  const log = (line) => logged.push(line);
  const site = EVERY.find((w) => w.name === '@livediagram/editor');
  const [build] = workerSteps(site, { environment: 'staging', ref: REF, exists: () => true });
  assert.deepEqual(runStep(build, { exec, baseEnv: { KEEP: '1' }, log }), { ok: true, retries: 0 });
  const run = calls.at(-1);
  assert.equal(run.line, 'pnpm turbo run build --filter=@livediagram/editor');
  assert.equal(run.env.NEXT_PUBLIC_TELEMETRY_URL, 'https://secret.example');
  assert.equal(run.env.NEXT_PUBLIC_BUILD_ID, REF);
  assert.equal(run.env.KEEP, '1');
  assert.equal(calls[0].capture, true);

  const api = EVERY.find((w) => w.name === '@livediagram/api');
  const [deploy] = workerSteps(api, { environment: 'staging', ref: REF });
  assert.deepEqual(runStep(deploy, { exec, baseEnv: {}, log }), { ok: true, retries: 0 });
  assert.equal(
    calls.at(-1).line,
    `pnpm exec wrangler deploy --env staging --var TELEMETRY_URL:https://secret.example --var BUILD_ID:${REF}`,
  );
  assert.ok(
    logged.every((line) => !line.includes('secret.example')),
    logged.join('\n'),
  );
  assert.match(logged.at(-1), /plus its hosted vars/);
});

test('a step whose capture fails runs nothing more', () => {
  const site = EVERY.find((w) => w.name === '@livediagram/editor');
  const [build] = workerSteps(site, { environment: 'staging', ref: REF, exists: () => true });
  const one = fakeExec({ failing: ['build-env'] });
  assert.equal(runStep(build, { exec: one.exec, baseEnv: {}, log: () => {} }).ok, false);
  assert.equal(one.calls.length, 1);

  const api = EVERY.find((w) => w.name === '@livediagram/api');
  const [deploy] = workerSteps(api, { environment: 'staging', ref: REF });
  const two = fakeExec({ failing: ['flags'] });
  assert.equal(runStep(deploy, { exec: two.exec, baseEnv: {}, log: () => {} }).ok, false);
  assert.equal(two.calls.length, 1);
});

test('one failing Worker stops at its step, and the group deploys every other Worker', () => {
  const group = EVERY.filter((w) => w.tier === 0);
  // The telemetry service's migration fails: its code must not deploy.
  const { exec, calls } = fakeExec({ failing: ['d1 migrations apply DB --remote --env staging'] });
  const failingDir = 'liveworkspace/apps/telemetry';
  const realExec = (cmd, args, opts) =>
    opts.cwd === failingDir || !args.includes('d1')
      ? exec(cmd, args, opts)
      : { status: 0, stdout: '' };
  const logged = [];
  let clock = 0;
  const results = deployGroup(group, {
    environment: 'staging',
    ref: REF,
    exec: realExec,
    log: (line) => logged.push(line),
    now: () => (clock += 1500),
  });
  assert.equal(results.length, 12);
  const failed = results.filter((r) => r.failed);
  assert.deepEqual(
    failed.map((r) => [r.name, r.failed]),
    [['@liveworkspace/telemetry-service', 'Apply D1 migrations']],
  );
  assert.ok(!calls.some((c) => c.cwd === failingDir && c.line.includes('wrangler deploy')));
  // Every other Worker's deploy ran.
  const deployed = calls
    .filter((c) => c.line.startsWith('pnpm exec wrangler deploy'))
    .map((c) => c.cwd);
  assert.equal(deployed.length, 11);
  // Each Worker's output is its own log group, and a failure is annotated.
  assert.equal(logged.filter((l) => l.startsWith('::group::')).length, 12);
  assert.equal(logged.filter((l) => l === '::endgroup::').length, 12);
  assert.ok(
    logged.includes(
      '::error title=@liveworkspace/telemetry-service did not deploy::Apply D1 migrations failed; see its log group',
    ),
  );
  assert.equal(results[0].seconds, 2);
});

test('the summary lists every Worker with its result, steps and time', () => {
  const ok = renderSummary('Routers', 'staging', [
    { name: '@a/router', failed: '', retries: 0, steps: ['Deploy'], seconds: 9 },
    { name: '@b/router', failed: '', retries: 1, steps: ['Deploy'], seconds: 40 },
  ]);
  assert.match(ok, /^### Routers: staging\n\nAll 2 Workers deployed\./);
  assert.match(ok, /\| `@a\/router` \| Deployed \| Deploy \| 9s \|/);
  assert.match(ok, /\| `@b\/router` \| Deployed after 1 retry \| Deploy \| 40s \|/);

  const bad = renderSummary('Sites (livediagram)', 'production', [
    { name: '@a/editor', failed: 'Build', steps: ['Build', 'Deploy'], seconds: 40 },
    { name: '@a/help', failed: 'Deploy', retries: 2, steps: ['Build', 'Deploy'], seconds: 200 },
  ]);
  assert.match(
    bad,
    /\| `@a\/help` \| Failed at Deploy after 2 retries \| Build, Deploy \| 200s \|/,
  );
  assert.match(
    bad,
    /2 of 2 Workers failed; the others deployed\. Re-running this job redeploys all of them, which is safe\./,
  );
  assert.match(bad, /\| `@a\/editor` \| Failed at Build \| Build, Deploy \| 40s \|/);
});

test('main deploys the group it is given, writes the summary, and fails when a Worker did', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-group-'));
  const summary = join(dir, 'summary.md');
  const base = {
    WORKERS: JSON.stringify(EVERY.filter((w) => w.tier === 1)),
    GROUP: 'liveworkspace',
    LABEL: 'Sites (liveworkspace)',
    ENVIRONMENT: 'production',
    REF,
    GITHUB_STEP_SUMMARY: summary,
  };
  const silenced = console.log;
  console.log = () => {};
  try {
    const good = fakeExec();
    assert.equal(main(base, good.exec), 0);
    // Only the group's own Workers: the platform's site and accounts.
    assert.deepEqual(
      [...new Set(good.calls.map((c) => c.cwd))],
      ['liveworkspace/apps/accounts', '.', 'liveworkspace/apps/site'],
    );
    assert.match(readFileSync(summary, 'utf8'), /All 2 Workers deployed\./);

    const bad = fakeExec({ failing: ['--filter=@liveworkspace/site'] });
    assert.equal(main(base, bad.exec), 1);
    assert.match(readFileSync(summary, 'utf8'), /Failed at Build/);

    // Without a summary file it prints the summary instead.
    const printed = [];
    console.log = (line) => printed.push(line);
    assert.equal(main({ ...base, GITHUB_STEP_SUMMARY: '', LABEL: '' }, fakeExec().exec), 0);
    assert.match(printed.at(-1), /^### liveworkspace: production/);
  } finally {
    console.log = silenced;
  }
});

test('main refuses a missing input or a group with no Workers', () => {
  const silenced = console.error;
  console.error = () => {};
  try {
    assert.equal(main({}, fakeExec().exec), 2);
    assert.equal(
      main({ WORKERS: '[]', GROUP: 'all', ENVIRONMENT: 'staging', REF }, fakeExec().exec),
      1,
    );
  } finally {
    console.error = silenced;
  }
});

test('the real runner streams or captures, and reports a failure or a missing command', () => {
  const env = process.env;
  const out = spawnExec(process.execPath, ['-e', 'console.log("A=1")'], {
    cwd: '.',
    env,
    capture: true,
  });
  assert.deepEqual(out, { status: 0, stdout: 'A=1\n' });
  assert.equal(
    spawnExec(process.execPath, ['-e', 'process.exit(3)'], { cwd: '.', env, capture: false })
      .status,
    3,
  );
  const silenced = console.error;
  console.error = () => {};
  try {
    assert.equal(spawnExec('no-such-command-here', [], { cwd: '.', env, capture: true }).status, 1);
  } finally {
    console.error = silenced;
  }
  assert.equal(MINUTES.command, 15);
});

test('a tee streams the output and returns it, stderr included, with the exit status', () => {
  const env = process.env;
  const run = spawnExec(
    process.execPath,
    ['-e', 'console.log("out $HOME"); console.error("err"); process.exit(4)'],
    { cwd: '.', env, tee: true },
  );
  assert.equal(run.status, 4);
  // The arguments reach the command as they are, never expanded by the shell.
  assert.equal(run.stdout, 'out $HOME\nerr\n');
  assert.deepEqual(spawnExec(process.execPath, ['-e', ''], { cwd: '.', env, tee: true }), {
    status: 0,
    stdout: '',
  });
});

test('run as a script, it exits with the code main returns', () => {
  const script = new URL('./deploy-group.mjs', import.meta.url).pathname;
  const env = { ...process.env, WORKERS: '', GROUP: '' };
  const run = spawnExec(process.execPath, [script], { cwd: '.', env, capture: true });
  assert.equal(run.status, 2);
});

// Trimmed from the production deploys of 2026-11-12, colour codes and all.
const ESC = String.fromCharCode(27);
const MALFORMED_524 = [
  '⛅️ wrangler 4.45.0',
  `${ESC}[31m✘ ${ESC}[41;31m[${ESC}[41;97mERROR${ESC}[41;31m]${ESC}[0m ${ESC}[1mReceived a malformed response from the API${ESC}[0m`,
  '  <!DOCTYPE html>',
  '  <title>api.cloudflare.com | 524: A timeout occurred</title>',
  '  POST /accounts/851be7d244b76a6557bcbe6c4ded80f5/workers/scripts/livediagram-mcp/versions -> 524 <none>',
].join('\n');
const ASSETS_CODE_MINUS_1 = [
  'Asset upload failed. Retrying... 4 of 5 attempts.',
  'Asset upload failed. Retrying... 5 of 5 attempts.',
  `${ESC}[31m✘ ${ESC}[41;31m[${ESC}[41;97mERROR${ESC}[41;31m]${ESC}[0m ${ESC}[1mA request to the Cloudflare API (/accounts/851be7d244b76a6557bcbe6c4ded80f5/workers/assets/upload?base64=true) failed.${ESC}[0m`,
  `  An unknown error has occurred. Please contact support: ${ESC}[4mhttps://cfl.re/3WgEyrH${ESC}[0m [code: -1]`,
].join('\n');

test("today's two Cloudflare API failures are transient", () => {
  assert.equal(isTransientCloudflareError(MALFORMED_524), true);
  assert.equal(isTransientCloudflareError(ASSETS_CODE_MINUS_1), true);
  assert.equal(
    isTransientCloudflareError(
      '✘ [ERROR] A request to the Cloudflare API (/accounts/a/workers/scripts/b) failed.\n  PUT /accounts/a/workers/scripts/b -> 503 Service Unavailable',
    ),
    true,
  );
  for (const status of [502, 503, 504, 524]) {
    assert.equal(
      isTransientCloudflareError(`GET /accounts/a/workers/services/b -> ${status} <none>`),
      true,
      String(status),
    );
  }
});

test('auth, validation, build and config errors are not transient', () => {
  const notTransient = [
    // Auth: a bad or under-scoped token.
    '✘ [ERROR] A request to the Cloudflare API (/accounts/a/workers/scripts/b) failed.\n  Authentication error [code: 10000]',
    '✘ [ERROR] Received a malformed response from the API\n  POST /accounts/a/workers/scripts/b/versions -> 403 Forbidden',
    'GET /accounts/a/workers/services/b -> 401 Unauthorized',
    // An auth failure that also met a gateway error is still an auth failure.
    'GET /accounts/a/x -> 502 <none>\n[code: 10000]',
    // Validation: the API answered, and said no.
    '✘ [ERROR] A request to the Cloudflare API (/accounts/a/workers/scripts/b/versions) failed.\n  Uncaught SyntaxError: Unexpected token [code: 10021]',
    // Build and config.
    '✘ [ERROR] Build failed with 1 error:\n  src/index.ts:3:7: ERROR: Expected ";" but found "x"',
    '✘ [ERROR] Missing entry-point to Worker script or to assets directory',
    '✘ [ERROR] Processing wrangler.toml configuration:\n  - "d1_databases[0]" bindings must have a "database_id" field',
    // A 5xx that is not a Cloudflare API request, and wrangler's own retries without its give-up.
    'Error: fetch https://example.com -> 503',
    'Asset upload failed. Retrying... 1 of 5 attempts.',
    '',
  ];
  for (const output of notTransient)
    assert.equal(isTransientCloudflareError(output), false, output);
});

// A runner whose deploy answers each attempt in turn, a status and its output.
function deployExec(attempts) {
  const calls = [];
  const exec = (cmd, args, opts) => {
    const line = `${cmd} ${args.join(' ')}`;
    calls.push({ line, ...opts });
    if (!line.includes('wrangler deploy') && !line.includes('migrations apply')) {
      return { status: 0, stdout: '' };
    }
    const [status, stdout] = attempts.shift() ?? [0, ''];
    return { status, stdout };
  };
  return { exec, calls };
}

const API = EVERY.find((w) => w.name === '@livediagram/api');
const MCP = EVERY.find((w) => w.name === '@livediagram/mcp');
const TELEMETRY = EVERY.find((w) => w.name === '@liveworkspace/telemetry-service');

function deployOne(target, attempts) {
  const { exec, calls } = deployExec(attempts);
  const waits = [];
  const logged = [];
  const [result] = deployGroup([target], {
    environment: 'production',
    ref: REF,
    exec,
    log: (line) => logged.push(line),
    sleep: (seconds) => waits.push(seconds),
  });
  const runs = calls.filter((c) => /wrangler (deploy|d1)/.test(c.line));
  return { result, runs, waits, logged };
}

test('a deploy that meets a Cloudflare API error succeeds on its second attempt', () => {
  const { result, runs, waits, logged } = deployOne(MCP, [[1, MALFORMED_524]]);
  assert.equal(result.failed, '');
  assert.equal(result.retries, 1);
  assert.equal(runs.length, 2);
  assert.ok(runs.every((r) => r.tee === true));
  assert.deepEqual(waits, [30]);
  assert.ok(
    logged.includes(
      '::warning title=Deploy retrying::Cloudflare API error, retrying in 30s (attempt 2 of 3)',
    ),
    logged.join('\n'),
  );
});

test('a deploy gives up after three attempts, having waited 30s then 120s', () => {
  const { result, runs, waits, logged } = deployOne(API, [
    [1, MALFORMED_524],
    [1, ASSETS_CODE_MINUS_1],
    [1, MALFORMED_524],
  ]);
  assert.equal(result.failed, 'Deploy');
  assert.equal(result.retries, 2);
  assert.equal(runs.length, 3);
  assert.deepEqual(waits, RETRY_WAITS);
  assert.deepEqual(RETRY_WAITS, [30, 120]);
  // Each attempt keeps its hosted vars.
  assert.ok(runs.every((r) => r.line.includes(`--var BUILD_ID:${REF}`)));
  assert.ok(logged.some((l) => l.includes('retrying in 120s (attempt 3 of 3)')));
  // The verify step after it never ran.
  assert.ok(!logged.some((l) => l.includes('Verify hosted vars')));
});

test('a deploy that fails for any other reason runs exactly once', () => {
  const { result, runs, waits } = deployOne(MCP, [
    [1, '✘ [ERROR] A request to the Cloudflare API failed.\n  Authentication error [code: 10000]'],
  ]);
  assert.equal(result.failed, 'Deploy');
  assert.equal(result.retries, 0);
  assert.equal(runs.length, 1);
  assert.deepEqual(waits, []);
});

test('a D1 migration is never retried, even on a Cloudflare API error', () => {
  const { result, runs, waits } = deployOne(TELEMETRY, [[1, MALFORMED_524]]);
  assert.equal(result.failed, 'Apply D1 migrations');
  assert.equal(result.retries, 0);
  assert.deepEqual(
    runs.map((r) => [r.line.includes('migrations apply'), r.tee]),
    [[true, false]],
  );
  assert.deepEqual(waits, []);
});

test('the real wait blocks for the time it is given', () => {
  const started = Date.now();
  sleepSync(0.05);
  assert.ok(Date.now() - started >= 45);
});

test('a deploy that ran out of time fails at once, even after a Cloudflare API error', () => {
  for (const status of TIMED_OUT) {
    const { result, runs, waits } = deployOne(MCP, [[status, MALFORMED_524]]);
    assert.equal(result.failed, 'Deploy');
    assert.equal(result.retries, 0);
    assert.equal(runs.length, 1);
    assert.deepEqual(waits, []);
  }
  assert.deepEqual(TIMED_OUT, [124, 137]);
});

test("a tee's limit stops the command itself, with timeout's exit", () => {
  const started = Date.now();
  const run = spawnExec(
    process.execPath,
    ['-e', 'console.log("started"); setTimeout(() => {}, 60_000)'],
    { cwd: '.', env: process.env, tee: true, seconds: 1 },
  );
  assert.ok(TIMED_OUT.includes(run.status), String(run.status));
  assert.equal(run.stdout, 'started\n');
  assert.ok(Date.now() - started < 10_000);
});
