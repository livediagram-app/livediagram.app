// The hosted profile (docs/specs/016-platform/deployment.md "Hosted profile"): the
// plain vars liveplanner.app's own deploys add on top of wrangler.toml, and a
// fork's do not. They live in `hosted-vars.json`, not in `[vars]`, because a
// committed `[vars]` value is every fork's default too; and not in the
// Cloudflare dashboard, because `wrangler deploy` replaces a worker's plain
// vars with whatever the deploy declares, silently wiping dashboard-only ones.
//
// Most hosted vars are shared by every environment; a few are per environment
// under `environments` (production, staging), such as the app's own base URL.
// An empty per-environment value means unset there: the feature stays off.
//
// Run from apps/api; `--env staging` picks staging, none picks production:
//
//   node scripts/hosted-vars.mjs flags [--env staging]
//       One token per line (`--var`, `KEY:VALUE`, ...) for `wrangler deploy`.
//   node scripts/hosted-vars.mjs build-env [--env staging]
//       The frontends' build-time mirror, as `KEY=VALUE` lines for $GITHUB_ENV.
//   node scripts/hosted-vars.mjs verify [--env staging] [wrangler args...]
//       Exits non-zero unless the worker's live deployment carries every hosted
//       var of the environment with its value, and none it leaves unset. The
//       args, `--env` included, reach wrangler.
//
// The pure helpers are exported for src/hosted-vars.test.ts.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HOSTED_VARS_PATH = fileURLToPath(new URL('../hosted-vars.json', import.meta.url));

const VAR_NAME = /^[A-Z][A-Z0-9_]*$/;
const ENVIRONMENTS = ['production', 'staging'];

/** Reads and validates the profile: shared NAME → non-empty string, plus
 *  `environments` with exactly production and staging, each declaring the same
 *  names (none of them also shared), whose values are strings, empty = unset. */
export function readHostedProfile(path = HOSTED_VARS_PATH) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`hosted-vars: ${path} must hold a JSON object`);
  }
  const { environments: rawEnvs, ...shared } = raw;
  for (const [name, value] of Object.entries(shared)) {
    if (!VAR_NAME.test(name)) throw new Error(`hosted-vars: invalid var name ${name}`);
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`hosted-vars: ${name} must be a non-empty string`);
    }
  }
  const environments = { production: {}, staging: {} };
  if (rawEnvs === undefined) return { shared, environments };
  const names = rawEnvs && typeof rawEnvs === 'object' ? Object.keys(rawEnvs).sort() : [];
  if (names.join() !== [...ENVIRONMENTS].sort().join()) {
    throw new Error('hosted-vars: environments must hold exactly production and staging');
  }
  for (const env of ENVIRONMENTS) {
    const vars = rawEnvs[env];
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) {
      throw new Error(`hosted-vars: environments.${env} must be an object`);
    }
    for (const [name, value] of Object.entries(vars)) {
      if (!VAR_NAME.test(name)) throw new Error(`hosted-vars: invalid var name ${name}`);
      if (typeof value !== 'string')
        throw new Error(`hosted-vars: ${env}.${name} must be a string`);
      if (name in shared)
        throw new Error(`hosted-vars: ${name} is per environment and also shared`);
    }
    environments[env] = vars;
  }
  const keys = (env) => Object.keys(environments[env]).sort().join();
  if (keys('production') !== keys('staging')) {
    throw new Error('hosted-vars: production and staging must declare the same names');
  }
  return { shared, environments };
}

/** The profile environment a wrangler env deploys: none is production. */
export function hostedEnvironment(wranglerEnv) {
  if (wranglerEnv === '') return 'production';
  if (wranglerEnv === 'staging') return 'staging';
  throw new Error(`hosted-vars: unknown environment ${wranglerEnv}`);
}

/** Shared vars plus the environment's set ones, and the names it leaves unset. */
export function resolveHostedVars(profile, environment) {
  const own = profile.environments[environment] ?? {};
  const vars = { ...profile.shared };
  const unset = [];
  for (const [name, value] of Object.entries(own)) {
    if (value === '') unset.push(name);
    else vars[name] = value;
  }
  return { vars, unset };
}

/** `--env <name>` off the arguments; the rest stay as given. */
export function splitEnvArg(args) {
  const at = args.indexOf('--env');
  if (at < 0) return { wranglerEnv: '', rest: [...args] };
  return { wranglerEnv: args[at + 1] ?? '', rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

/** `{ A: '1' }` → `['--var', 'A:1']`. Wrangler splits each pair on its first colon. */
export function wranglerVarFlags(vars) {
  return Object.entries(vars).flatMap(([name, value]) => ['--var', `${name}:${value}`]);
}

/** The build-time twins of hosted worker vars: each frontend reads
 *  NEXT_PUBLIC_TELEMETRY_ENABLED to skip emitting when telemetry is off, and
 *  NEXT_PUBLIC_TELEMETRY_URL for which central telemetry service to send to. */
export function buildEnv(vars) {
  const out = [];
  if (vars.TELEMETRY_ENABLED) out.push(`NEXT_PUBLIC_TELEMETRY_ENABLED=${vars.TELEMETRY_ENABLED}`);
  if (vars.TELEMETRY_URL) out.push(`NEXT_PUBLIC_TELEMETRY_URL=${vars.TELEMETRY_URL}`);
  return out;
}

/** Version ids serving traffic, from `wrangler deployments status --json`. */
export function activeVersionIds(status) {
  const versions = Array.isArray(status?.versions) ? status.versions : [];
  return versions.filter((v) => v.percentage > 0).map((v) => v.version_id);
}

/** Plain-text vars bound to one version, from `wrangler versions view --json`. */
export function plainVars(view) {
  const bindings = Array.isArray(view?.resources?.bindings) ? view.resources.bindings : [];
  return new Map(
    bindings.filter((b) => b.type === 'plain_text').map((b) => [b.name, String(b.text)]),
  );
}

/** Every var this environment leaves unset that the deployed version still holds. */
export function unsetVarDrift(unset, deployed) {
  return unset
    .filter((name) => deployed.has(name))
    .map((name) => ({ name, expected: '(unset)', actual: deployed.get(name) }));
}

/** Every hosted var the deployed version lacks or holds with a different value. */
export function hostedVarDrift(expected, deployed) {
  return Object.entries(expected)
    .filter(([name, value]) => deployed.get(name) !== value)
    .map(([name, value]) => ({ name, expected: value, actual: deployed.get(name) ?? null }));
}

function wranglerJson(args) {
  const out = execFileSync('pnpm', ['exec', 'wrangler', ...args, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out);
}

function verify(args) {
  const { wranglerEnv } = splitEnvArg(args);
  const { vars: expected, unset } = resolveHostedVars(
    readHostedProfile(),
    hostedEnvironment(wranglerEnv),
  );
  const wranglerArgs = args;
  const versionIds = activeVersionIds(wranglerJson(['deployments', 'status', ...wranglerArgs]));
  if (versionIds.length === 0) {
    console.error('hosted-vars verify: FAILED, no version is serving traffic');
    return 1;
  }
  let failed = false;
  for (const id of versionIds) {
    const deployed = plainVars(wranglerJson(['versions', 'view', id, ...wranglerArgs]));
    const drift = [...hostedVarDrift(expected, deployed), ...unsetVarDrift(unset, deployed)];
    for (const d of drift) {
      console.error(
        `hosted-vars verify: FAILED, version ${id} has ${d.name}=${d.actual ?? '(unset)'}, expected ${d.expected}`,
      );
    }
    failed ||= drift.length > 0;
  }
  if (failed) return 1;
  console.log(
    `hosted-vars verify: ok, ${Object.keys(expected).join(', ')} live on ${versionIds.join(', ')}`,
  );
  return 0;
}

function resolvedFor(args) {
  return resolveHostedVars(readHostedProfile(), hostedEnvironment(splitEnvArg(args).wranglerEnv));
}

function main([command, ...rest]) {
  switch (command) {
    case 'flags':
      console.log(wranglerVarFlags(resolvedFor(rest).vars).join('\n'));
      return 0;
    case 'build-env':
      console.log(buildEnv(resolvedFor(rest).vars).join('\n'));
      return 0;
    case 'verify':
      return verify(rest);
    default:
      console.error('usage: hosted-vars.mjs flags | build-env | verify  [--env staging]');
      return 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
