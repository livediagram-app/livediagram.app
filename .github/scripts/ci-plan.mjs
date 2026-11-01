// Plans a CI run (docs/ci.md): which workspaces it checks, tests and builds, grouped by product.
//
// Turborepo answers what a change affects: the workspaces whose files changed, and every workspace
// that depends on one of them (a change to packages/ui reaches every product's editor). A change to
// the lockfile reaches the workspaces whose dependencies moved, and one to turbo.json's global
// dependencies reaches all of them. This script groups that answer by product, so a product nothing
// reached runs no jobs at all, and splits each group's tests the way the products' own CI did:
// workspaces with `test:coverage` run it (it enforces their thresholds), the rest run `test`, and
// each product's editor runs in shards of its own.
//
//   BASE=<sha or empty> HEAD=<sha> node .github/scripts/ci-plan.mjs
//
// With no BASE (a manual run, the nightly run, a new branch's first push) or a change to CI itself
// or to the root's shared config, everything runs. Writes `groups`, `editors`, `e2e`, `deploys` and
// `any` to $GITHUB_OUTPUT when it is set, and prints the plan either way.
//
// The deploys (docs/ci.md "Deploys") read the same answer with PLAN_MODE=deploy and BASE set to the
// commit the environment last deployed: every affected workspace with a wrangler.toml is a Worker to
// build and deploy, in three tiers (services and apis, then the sites, then the routers in front).
// A change to .github/ or the format config alone redeploys nothing.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { readersReached, repoReaders } from './ci-readers.mjs';

// turbo without installing the workspace (it reads only the manifests and the lockfile). Locally:
// TURBO_CMD='corepack pnpm exec turbo'.
const [TURBO_BIN, ...TURBO] = (process.env.TURBO_CMD ?? 'pnpm dlx turbo@2.11.10').split(' ');

// Each group: its folders, its big editor app (sharded), its CLI (packed), and how it checks format.
const GROUPS = [
  {
    group: 'livediagram',
    dirs: ['livediagram/'],
    editor: '@livediagram/editor',
    editorDir: 'livediagram/apps/editor',
    cli: 'livediagram/apps/cli',
  },
  {
    group: 'liveplanner',
    dirs: ['liveplanner/'],
    editor: '@liveplanner/editor',
    editorDir: 'liveplanner/apps/editor',
    cli: 'liveplanner/apps/cli',
  },
  {
    group: 'livedesign',
    dirs: ['livedesign/'],
    editor: '@livedesign/live',
    editorDir: 'livedesign/apps/live',
    cli: 'livedesign/apps/cli',
  },
  {
    group: 'livedocuments',
    dirs: ['livedocuments/'],
    editor: '@livedocuments/editor',
    editorDir: 'livedocuments/apps/editor',
    cli: 'livedocuments/apps/cli',
  },
  // Held until its launch (livehuddle/docs/specs/005-project-roadmap/build-plan.md step 8): its suites run only when
  // a change touches livehuddle/ itself (or everything runs), never because a shared package it uses changed; it has
  // no E2E yet, and none of its Workers deploy.
  {
    group: 'livehuddle',
    dirs: ['livehuddle/'],
    editor: '@livehuddle/editor',
    editorDir: 'livehuddle/apps/editor',
    cli: 'livehuddle/apps/cli',
    held: true,
  },
  {
    group: 'platform',
    dirs: ['packages/', 'liveworkspace/'],
    editor: null,
    editorDir: null,
    cli: null,
  },
];

// The editor suites are split three ways, as each product's CI did (most of a product's tests).
const EDITOR_SHARDS = 3;

// Changing one of these can break any workspace without turbo seeing it as theirs: run everything.
const RUN_ALL = [
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^turbo\.json$/,
  /^tsconfig\.base\.json$/,
  /^prettier\.config\.js$/,
  /^\.prettierignore$/,
  /^\.npmrc$/,
  /^(livediagram|liveplanner|livedesign|livedocuments|livehuddle)\/(package\.json|tsconfig\.base\.json|prettier\.config\.js|\.prettierignore)$/,
];

// Deploys ignore what only CI and formatting read.
const DEPLOY_IGNORES = [/^\.github\//, /prettier\.config\.js$/, /\.prettierignore$/];
const deployMode = process.env.PLAN_MODE === 'deploy';

const base = (process.env.BASE ?? '').trim();
const head = (process.env.HEAD ?? '').trim() || 'HEAD';
const noBase = !base || /^0+$/.test(base);

function changedFiles() {
  return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function turboPackages(affected) {
  const env = { ...process.env, TURBO_TELEMETRY_DISABLED: '1' };
  if (affected) Object.assign(env, { TURBO_SCM_BASE: base, TURBO_SCM_HEAD: head });
  const args = [...TURBO, 'ls', ...(affected ? ['--affected'] : []), '--output=json'];
  const out = execFileSync(TURBO_BIN, args, {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out.slice(out.indexOf('{'))).packages.items;
}

let reason;
let all = noBase;
const changed = noBase ? [] : changedFiles();
if (noBase) reason = 'no base commit: everything';
else {
  const forcing = changed.filter(
    (file) =>
      RUN_ALL.some((re) => re.test(file)) &&
      !(deployMode && DEPLOY_IGNORES.some((re) => re.test(file))),
  );
  if (forcing.length) {
    all = true;
    reason = `shared config changed (${forcing.slice(0, 5).join(', ')}${forcing.length > 5 ? ', …' : ''}): everything`;
  } else reason = `affected since ${base.slice(0, 12)}`;
}

const packages = turboPackages(!all);

// The suites that read another workspace's files (turbo.json's `$TURBO_ROOT$/…` test inputs, see
// ci-readers.mjs) run when the change touches what they read, though turbo's graph never reaches them.
// Deploys skip this: a test reading a Worker's files is no reason to redeploy it.
if (!all && !deployMode) {
  const missing = readersReached(repoReaders(), changed).filter(
    (name) => !packages.some((p) => p.name === name),
  );
  if (missing.length) {
    const every = turboPackages(false);
    for (const name of missing) {
      const found = every.find((p) => p.name === name);
      if (found) packages.push(found);
    }
    reason += `, plus the suites reading it (${missing.join(', ')})`;
  }
}

function scriptsOf(path) {
  try {
    return JSON.parse(readFileSync(`${path}/package.json`, 'utf8')).scripts ?? {};
  } catch {
    return {};
  }
}

const filters = (names) => names.map((name) => `--filter=${name}`).join(' ');

const groups = [];
const editors = [];
const e2e = [];
for (const spec of GROUPS) {
  const members = packages.filter((p) => spec.dirs.some((dir) => `${p.path}/`.startsWith(dir)));
  // A product's root is a workspace too (its scripts), but has nothing of its own to run.
  const runnable = members.filter((p) => !GROUPS.some((g) => g.dirs.includes(`${p.path}/`)));
  if (runnable.length === 0) continue;
  // A held product runs on its own changes only, so a change to a shared package doesn't pay for its whole suite.
  if (spec.held && !all && !changed.some((file) => spec.dirs.some((dir) => file.startsWith(dir))))
    continue;
  const editorAffected = spec.editor && runnable.some((p) => p.name === spec.editor);
  const tested = runnable.filter((p) => p.name !== spec.editor);
  const coverage = tested.filter((p) => scriptsOf(p.path)['test:coverage']).map((p) => p.name);
  const plain = tested
    .filter((p) => !scriptsOf(p.path)['test:coverage'] && scriptsOf(p.path).test)
    .map((p) => p.name);
  groups.push({
    group: spec.group,
    count: runnable.length,
    filters: filters(runnable.map((p) => p.name)),
    coverage: filters(coverage),
    plain: filters(plain),
    cli: spec.cli && runnable.some((p) => p.path === spec.cli) ? spec.cli : '',
    format: spec.group === 'platform' ? '' : spec.group,
    // The format check covers only the files the change touched (format-check.sh); with no base, all.
    base: noBase ? '' : base,
  });
  if (editorAffected) {
    for (let shard = 1; shard <= EDITOR_SHARDS; shard++) {
      editors.push({
        group: spec.group,
        editor: spec.editor,
        dir: spec.editorDir,
        shard,
        total: EDITOR_SHARDS,
      });
    }
    if (!spec.held) e2e.push(spec.group);
  }
}

// The Workers among the affected workspaces. Tier 0: the services and apis everything else calls
// (D1 migrations apply before each Worker's code, in any tier); tier 2: the routers in front of the
// rest; tier 1: the sites between. Two exceptions (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."):
// accounts goes in tier 1, after every Worker that checks its tokens has learned to accept the issuer
// it is about to sign with, and liveworkspace's bare-domain redirect in tier 2, once www. answers.
const TIER_OF = new Map([
  ['liveworkspace/apps/accounts', 1],
  ['liveworkspace/apps/redirect', 2],
]);
// A held product's Workers never deploy: its first deploy is its launch card's.
const HELD_PRODUCTS = new Set(
  GROUPS.filter((g) => g.held).flatMap((g) => g.dirs.map((d) => d.replace(/\/$/, ''))),
);
function deployOf(p) {
  const toml = `${p.path}/wrangler.toml`;
  if (!existsSync(toml)) return null;
  const product = p.path.split('/')[0];
  if (HELD_PRODUCTS.has(product)) return null;
  const config = readFileSync(toml, 'utf8');
  const app = p.path.split('/').pop();
  const d1 = existsSync(`${p.path}/migrations`)
    ? (config.match(/^\[\[d1_databases\]\][^[]*?^binding\s*=\s*"([^"]+)"/ms)?.[1] ?? '')
    : '';
  const tier =
    TIER_OF.get(p.path) ??
    (app === 'router'
      ? 2
      : app === 'api' || (product === 'liveworkspace' && app !== 'site')
        ? 0
        : 1);
  const hosted = existsSync(`${p.path}/scripts/hosted-vars.mjs`) ? product : '';
  return {
    name: p.name,
    dir: p.path,
    product,
    tier,
    d1,
    // A static site serves its build (`[assets]`); a Worker's own build is the bundle wrangler makes anyway.
    build: /^\[assets\]/m.test(config),
    // A help site dates each article by its last commit (packages/help-site article-dates.ts), so it
    // builds from full history; every other Worker builds from the one commit.
    history: app === 'help',
    hosted,
  };
}
const deploys = packages.map(deployOf).filter(Boolean);

const plan = { reason, groups, editors, e2e, deploys, any: groups.length > 0 };
console.error(`[ci-plan] ${reason}; ${packages.length} workspaces`);
for (const g of groups) console.error(`[ci-plan]   ${g.group}: ${g.count}${g.cli ? ', CLI' : ''}`);
if (deployMode)
  console.error(`[ci-plan]   Workers: ${deploys.map((d) => d.name).join(', ') || 'none'}`);
console.error(
  `[ci-plan]   editor shards: ${[...new Set(editors.map((e) => e.group))].join(', ') || 'none'}`,
);
console.log(JSON.stringify(plan, null, 2));

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `groups=${JSON.stringify(groups)}`,
    `editors=${JSON.stringify(editors)}`,
    `e2e=${JSON.stringify(e2e)}`,
    ...[0, 1, 2].map(
      (tier) => `deploys${tier}=${JSON.stringify(deploys.filter((d) => d.tier === tier))}`,
    ),
    `any=${plan.any}`,
  ];
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}
