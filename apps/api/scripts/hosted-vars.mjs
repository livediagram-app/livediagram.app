// The hosted profile (docs/specs/016-platform/deployment.md "Hosted profile"): the
// plain vars livediagram.app's own deploys add on top of wrangler.toml, and a
// fork's do not. They live in `hosted-vars.json`, not in `[vars]`, because a
// committed `[vars]` value is every fork's default too; and not in the
// Cloudflare dashboard, because `wrangler deploy` replaces a worker's plain
// vars with whatever the deploy declares, silently wiping dashboard-only ones.
//
// Run from apps/api:
//
//   node scripts/hosted-vars.mjs flags
//       One token per line (`--var`, `KEY:VALUE`, ...) for `wrangler deploy`.
//   node scripts/hosted-vars.mjs build-env
//       The frontends' build-time mirror, as `KEY=VALUE` lines for $GITHUB_ENV.
//   node scripts/hosted-vars.mjs verify [wrangler args...]
//       Exits non-zero unless the worker's live deployment carries every hosted
//       var with the expected value. Extra args reach wrangler (`--env staging`).
//
// The pure helpers are exported for src/hosted-vars.test.ts.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HOSTED_VARS_PATH = fileURLToPath(new URL('../hosted-vars.json', import.meta.url));

const VAR_NAME = /^[A-Z][A-Z0-9_]*$/;

/** Reads and validates the profile: a flat object of NAME → non-empty string. */
export function readHostedVars(path = HOSTED_VARS_PATH) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`hosted-vars: ${path} must hold a JSON object`);
  }
  for (const [name, value] of Object.entries(raw)) {
    if (!VAR_NAME.test(name)) throw new Error(`hosted-vars: invalid var name ${name}`);
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`hosted-vars: ${name} must be a non-empty string`);
    }
  }
  return raw;
}

/** `{ A: '1' }` → `['--var', 'A:1']`. Wrangler splits each pair on its first colon. */
export function wranglerVarFlags(vars) {
  return Object.entries(vars).flatMap(([name, value]) => ['--var', `${name}:${value}`]);
}

/** The build-time twins of hosted worker vars: each frontend reads
 *  NEXT_PUBLIC_TELEMETRY_ENABLED to skip emitting when the api would drop it. */
export function buildEnv(vars) {
  return vars.TELEMETRY_ENABLED ? [`NEXT_PUBLIC_TELEMETRY_ENABLED=${vars.TELEMETRY_ENABLED}`] : [];
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

function verify(wranglerArgs) {
  const expected = readHostedVars();
  const versionIds = activeVersionIds(wranglerJson(['deployments', 'status', ...wranglerArgs]));
  if (versionIds.length === 0) {
    console.error('hosted-vars verify: FAILED, no version is serving traffic');
    return 1;
  }
  let failed = false;
  for (const id of versionIds) {
    const drift = hostedVarDrift(
      expected,
      plainVars(wranglerJson(['versions', 'view', id, ...wranglerArgs])),
    );
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

function main([command, ...rest]) {
  switch (command) {
    case 'flags':
      console.log(wranglerVarFlags(readHostedVars()).join('\n'));
      return 0;
    case 'build-env':
      console.log(buildEnv(readHostedVars()).join('\n'));
      return 0;
    case 'verify':
      return verify(rest);
    default:
      console.error('usage: hosted-vars.mjs flags | build-env | verify [wrangler args...]');
      return 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
