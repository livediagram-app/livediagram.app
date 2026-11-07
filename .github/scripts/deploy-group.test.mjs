import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MINUTES,
  deployGroup,
  deployGroups,
  groupOf,
  main,
  parseEnvLines,
  renderSummary,
  runStep,
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
      timeout: 10 + 12 * 2,
      workers: undefined,
    },
  );

  const sites = deployGroups(EVERY, 1);
  assert.deepEqual(
    sites.map((g) => [g.label, g.count, g.history, g.timeout]),
    [
      ...PRODUCTS.map((p) => [`Sites (${p})`, 4, true, 10 + 3 * 6 + 2]),
      ['Sites (liveworkspace)', 2, false, 10 + 6 + 2],
    ],
  );
  assert.equal(
    sites[1].workers,
    '@livediagram/editor, @livediagram/help, @livediagram/marketing, @livediagram/mcp',
  );

  const routers = deployGroups(EVERY, 2);
  assert.deepEqual(
    routers.map((g) => [g.label, g.count, g.timeout]),
    [['Routers', 6, 10 + 6 * 2]],
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
      NEXT_PUBLIC_MCP_ORIGIN: 'https://livediagram-mcp-staging.liveworkspace-easing509.workers.dev',
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
  assert.equal(runStep(build, { exec, baseEnv: { KEEP: '1' }, log }), true);
  const run = calls.at(-1);
  assert.equal(run.line, 'pnpm turbo run build --filter=@livediagram/editor');
  assert.equal(run.env.NEXT_PUBLIC_TELEMETRY_URL, 'https://secret.example');
  assert.equal(run.env.NEXT_PUBLIC_BUILD_ID, REF);
  assert.equal(run.env.KEEP, '1');
  assert.equal(calls[0].capture, true);

  const api = EVERY.find((w) => w.name === '@livediagram/api');
  const [deploy] = workerSteps(api, { environment: 'staging', ref: REF });
  assert.equal(runStep(deploy, { exec, baseEnv: {}, log }), true);
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
  assert.equal(runStep(build, { exec: one.exec, baseEnv: {}, log: () => {} }), false);
  assert.equal(one.calls.length, 1);

  const api = EVERY.find((w) => w.name === '@livediagram/api');
  const [deploy] = workerSteps(api, { environment: 'staging', ref: REF });
  const two = fakeExec({ failing: ['flags'] });
  assert.equal(runStep(deploy, { exec: two.exec, baseEnv: {}, log: () => {} }), false);
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
    { name: '@a/router', failed: '', steps: ['Deploy'], seconds: 9 },
  ]);
  assert.match(ok, /^### Routers: staging\n\nAll 1 Workers deployed\./);
  assert.match(ok, /\| `@a\/router` \| Deployed \| Deploy \| 9s \|/);

  const bad = renderSummary('Sites (livediagram)', 'production', [
    { name: '@a/editor', failed: 'Build', steps: ['Build', 'Deploy'], seconds: 40 },
    { name: '@a/help', failed: '', steps: ['Build', 'Deploy'], seconds: 50 },
  ]);
  assert.match(
    bad,
    /1 of 2 Workers failed; the others deployed\. Re-running this job redeploys all of them, which is safe\./,
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

test('run as a script, it exits with the code main returns', () => {
  const script = new URL('./deploy-group.mjs', import.meta.url).pathname;
  const env = { ...process.env, WORKERS: '', GROUP: '' };
  const run = spawnExec(process.execPath, [script], { cwd: '.', env, capture: true });
  assert.equal(run.status, 2);
});
