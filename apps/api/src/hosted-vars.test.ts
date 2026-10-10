import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePositiveCap } from './routes/images';

// The hosted profile (docs/specs/016-platform/deployment.md "Hosted profile"):
// the vars livediagram.app's deploys add, and a fork's do not. Two promises
// hang on it: a fork deploying the repo as documented is telemetry-off and
// uncapped, and the hosted deployment's image caps survive every deploy.

type Profile = {
  shared: Record<string, string>;
  environments: Record<'production' | 'staging', Record<string, string>>;
};

interface HostedVarsModule {
  HOSTED_VARS_PATH: string;
  readHostedProfile: (path?: string) => Profile;
  hostedEnvironment: (wranglerEnv: string) => 'production' | 'staging';
  resolveHostedVars: (
    profile: Profile,
    environment: 'production' | 'staging',
  ) => { vars: Record<string, string>; unset: string[] };
  splitEnvArg: (args: string[]) => { wranglerEnv: string; rest: string[] };
  unsetVarDrift: (
    unset: string[],
    deployed: Map<string, string>,
  ) => { name: string; expected: string; actual: string | null }[];
  clientIdBuildDrift: (texts: string[], expected: string | null, others: string[]) => string[];
  wranglerVarFlags: (vars: Record<string, string>) => string[];
  buildEnv: (vars: Record<string, string>) => string[];
  activeVersionIds: (status: unknown) => string[];
  plainVars: (view: unknown) => Map<string, string>;
  hostedVarDrift: (
    expected: Record<string, string>,
    deployed: Map<string, string>,
  ) => { name: string; expected: string; actual: string | null }[];
}

// Computed URL so tsc doesn't try to resolve the untyped build script.
const scriptUrl = new URL('../scripts/hosted-vars.mjs', import.meta.url).href;
const load = async () => (await import(scriptUrl)) as HostedVarsModule;

const readApiFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url).href), 'utf8');

/** The `KEY = ...` names declared directly under one wrangler.toml table header. */
function tomlTableKeys(toml: string, header: string): string[] {
  const lines = toml.split('\n');
  const start = lines.findIndex((l) => l.trim() === `[${header}]`);
  if (start < 0) return [];
  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith('[')) break;
    const m = /^([A-Z][A-Z0-9_]*)\s*=/.exec(line.trim());
    if (m) keys.push(m[1]!);
  }
  return keys;
}

describe('hosted profile', () => {
  it('turns telemetry on and caps every owner gallery', async () => {
    const vars = (await load()).readHostedProfile().shared;
    expect(vars.TELEMETRY_ENABLED).toBe('true');
    // The worker's own parser: a value it reads as "no cap" would leave R2
    // unguarded while this file looked right.
    expect(parsePositiveCap(vars.IMAGE_MAX_PER_OWNER)).toBe(100);
    expect(parsePositiveCap(vars.IMAGE_MAX_BYTES_PER_OWNER)).toBe(100 * 1024 * 1024);
    // And per network per day, which rotating guest identities can't sidestep
    // (docs/specs/009-elements/images.md "Per-network daily budget").
    expect(parsePositiveCap(vars.IMAGE_MAX_PER_NETWORK_DAY)).toBe(2000);
    expect(parsePositiveCap(vars.IMAGE_MAX_BYTES_PER_NETWORK_DAY)).toBe(1024 * 1024 * 1024);
  });

  it('names only vars the worker reads', async () => {
    const types = readApiFile('src/types.ts');
    const { shared, environments } = (await load()).readHostedProfile();
    const names = [...Object.keys(shared), ...Object.keys(environments.production)];
    for (const name of names) {
      expect(types, `${name} is not on Env`).toMatch(new RegExp(`\\b${name}\\?: string;`));
    }
  });

  it('is never a committed default, so a fork is telemetry-off and uncapped', async () => {
    const { shared, environments } = (await load()).readHostedProfile();
    const hosted = [
      ...Object.keys(shared),
      ...Object.keys(environments.production),
      ...Object.keys(environments.staging),
    ];
    const toml = readApiFile('wrangler.toml');
    for (const table of ['vars', 'env.staging.vars']) {
      const declared = tomlTableKeys(toml, table).filter((k) => hosted.includes(k));
      expect(declared, `[${table}] declares hosted-only vars`).toEqual([]);
    }
    // Vacuity guard: the table reader must still see what IS committed.
    expect(tomlTableKeys(toml, 'vars')).toContain('AI_ALLOWED_ORIGINS');
    expect(tomlTableKeys(toml, 'env.staging.vars')).toContain('AI_ALLOWED_ORIGINS');
  });
});

describe('hosted-vars script', () => {
  it('renders one --var pair per hosted var', async () => {
    const { wranglerVarFlags } = await load();
    expect(wranglerVarFlags({ A: '1', B: 'x:y' })).toEqual(['--var', 'A:1', '--var', 'B:x:y']);
  });

  it('mirrors telemetry into the frontend build, and nothing when it is off', async () => {
    const { buildEnv } = await load();
    expect(buildEnv({ TELEMETRY_ENABLED: 'true', IMAGE_MAX_PER_OWNER: '1' })).toEqual([
      'NEXT_PUBLIC_TELEMETRY_ENABLED=true',
    ]);
    expect(buildEnv({ IMAGE_MAX_PER_OWNER: '1' })).toEqual([]);
  });

  it('hands the Google client id to the frontends (docs/specs/022-drive-mirror/drive-mirror.md)', async () => {
    const { buildEnv } = await load();
    expect(buildEnv({ GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com' })).toEqual([
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com',
    ]);
  });

  it('rejects a malformed profile rather than deploying half of it', async () => {
    const { readHostedProfile: readHostedVars } = await load();
    const dir = mkdtempSync(join(tmpdir(), 'hosted-vars-'));
    const write = (body: string) => {
      const path = join(dir, 'vars.json');
      writeFileSync(path, body);
      return path;
    };
    expect(() => readHostedVars(write('[]'))).toThrow(/JSON object/);
    expect(() => readHostedVars(write('{"lower": "1"}'))).toThrow(/invalid var name/);
    expect(() => readHostedVars(write('{"CAP": 100}'))).toThrow(/non-empty string/);
    expect(() => readHostedVars(write('{"CAP": ""}'))).toThrow(/non-empty string/);
    const envs = (production: unknown, staging: unknown, extra = '') =>
      write(
        `{"CAP": "1", "environments": {"production": ${JSON.stringify(production)}, "staging": ${JSON.stringify(staging)}${extra}}}`,
      );
    expect(() => readHostedVars(write('{"environments": {"production": {}}}'))).toThrow(
      /production and staging/,
    );
    expect(() => readHostedVars(envs({ A: '' }, {}, ', "dev": {}'))).toThrow(
      /production and staging/,
    );
    expect(() => readHostedVars(envs({ A: '' }, { B: '' }))).toThrow(/same names/);
    expect(() => readHostedVars(envs({ CAP: '' }, { CAP: '' }))).toThrow(/also shared/);
    expect(() => readHostedVars(envs({ A: 1 }, { A: '' }))).toThrow(/string/);
    expect(() => readHostedVars(envs({ a: '' }, { a: '' }))).toThrow(/invalid var name/);
    expect(readHostedVars(envs({ A: 'x' }, { A: '' }))).toEqual({
      shared: { CAP: '1' },
      environments: { production: { A: 'x' }, staging: { A: '' } },
    });
  });

  // Shapes as `wrangler deployments status --json` / `versions view --json`
  // print them (wrangler 4).
  const status = {
    versions: [
      { version_id: 'v-new', percentage: 100 },
      { version_id: 'v-old', percentage: 0 },
    ],
  };
  const view = {
    resources: {
      bindings: [
        { type: 'plain_text', name: 'TELEMETRY_ENABLED', text: 'true' },
        { type: 'plain_text', name: 'IMAGE_MAX_PER_OWNER', text: '50' },
        { type: 'secret_text', name: 'CLERK_JWKS_URL' },
        { type: 'd1', name: 'DB' },
      ],
    },
  };

  it('verifies only the versions serving traffic', async () => {
    const { activeVersionIds } = await load();
    expect(activeVersionIds(status)).toEqual(['v-new']);
    expect(activeVersionIds({})).toEqual([]);
  });

  it('reports every hosted var a deployment lacks or holds with another value', async () => {
    const { hostedVarDrift, plainVars } = await load();
    const drift = hostedVarDrift(
      { TELEMETRY_ENABLED: 'true', IMAGE_MAX_PER_OWNER: '100', IMAGE_MAX_BYTES_PER_OWNER: '9' },
      plainVars(view),
    );
    expect(drift).toEqual([
      { name: 'IMAGE_MAX_PER_OWNER', expected: '100', actual: '50' },
      { name: 'IMAGE_MAX_BYTES_PER_OWNER', expected: '9', actual: null },
    ]);
    expect(hostedVarDrift({ TELEMETRY_ENABLED: 'true' }, plainVars(view))).toEqual([]);
    expect(plainVars({}).size).toBe(0);
  });
});

// The Drive mirror's Google identity is per environment: livediagram.app runs one
// Google Cloud project for production and one for staging
// (docs/specs/022-drive-mirror/drive-mirror.md, "Hosted deployment").
describe('hosted profile per environment', () => {
  const profile: Profile = {
    shared: { TELEMETRY_ENABLED: 'true' },
    environments: {
      production: { GOOGLE_CLIENT_ID: '111-prod.apps.googleusercontent.com' },
      staging: { GOOGLE_CLIENT_ID: '222-staging.apps.googleusercontent.com' },
    },
  };

  it('names the environment by the wrangler env, and refuses any other', async () => {
    const { hostedEnvironment } = await load();
    expect(hostedEnvironment('')).toBe('production');
    expect(hostedEnvironment('staging')).toBe('staging');
    expect(() => hostedEnvironment('prod')).toThrow(/unknown environment/);
  });

  it('reads --env off the command line and leaves the rest for wrangler', async () => {
    const { splitEnvArg } = await load();
    expect(splitEnvArg([])).toEqual({ wranglerEnv: '', rest: [] });
    expect(splitEnvArg(['--env', 'staging', 'out'])).toEqual({
      wranglerEnv: 'staging',
      rest: ['out'],
    });
  });

  it("resolves each environment's own client id, shared vars beside it", async () => {
    const { resolveHostedVars } = await load();
    expect(resolveHostedVars(profile, 'staging')).toEqual({
      vars: {
        TELEMETRY_ENABLED: 'true',
        GOOGLE_CLIENT_ID: '222-staging.apps.googleusercontent.com',
      },
      unset: [],
    });
    expect(resolveHostedVars(profile, 'production').vars.GOOGLE_CLIENT_ID).toBe(
      '111-prod.apps.googleusercontent.com',
    );
  });

  it('leaves an empty entry unset: no --var, no build twin, so the mirror stays off', async () => {
    const { resolveHostedVars, wranglerVarFlags, buildEnv } = await load();
    const empty: Profile = {
      ...profile,
      environments: { ...profile.environments, staging: { GOOGLE_CLIENT_ID: '' } },
    };
    const { vars, unset } = resolveHostedVars(empty, 'staging');
    expect(unset).toEqual(['GOOGLE_CLIENT_ID']);
    expect(wranglerVarFlags(vars)).toEqual(['--var', 'TELEMETRY_ENABLED:true']);
    expect(buildEnv(vars)).toEqual(['NEXT_PUBLIC_TELEMETRY_ENABLED=true']);
  });

  it('gives the worker and the live build of one environment the same client id', async () => {
    const { resolveHostedVars, wranglerVarFlags, buildEnv } = await load();
    for (const env of ['production', 'staging'] as const) {
      const { vars } = resolveHostedVars(profile, env);
      const id = profile.environments[env].GOOGLE_CLIENT_ID;
      expect(wranglerVarFlags(vars)).toContain(`GOOGLE_CLIENT_ID:${id}`);
      expect(buildEnv(vars)).toContain(`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${id}`);
    }
  });

  it('verify fails when a deployment still holds a var this environment leaves unset', async () => {
    const { unsetVarDrift } = await load();
    const deployed = new Map([['GOOGLE_CLIENT_ID', '111-prod.apps.googleusercontent.com']]);
    expect(unsetVarDrift(['GOOGLE_CLIENT_ID'], deployed)).toEqual([
      {
        name: 'GOOGLE_CLIENT_ID',
        expected: '(unset)',
        actual: '111-prod.apps.googleusercontent.com',
      },
    ]);
    expect(unsetVarDrift(['GOOGLE_CLIENT_ID'], new Map())).toEqual([]);
  });

  it("verify-build finds the environment's client id in the live build, and never another's", async () => {
    const { clientIdBuildDrift } = await load();
    const prod = '111-prod.apps.googleusercontent.com';
    const staging = '222-staging.apps.googleusercontent.com';
    expect(clientIdBuildDrift(['a', `x"${staging}"y`], staging, [prod])).toEqual([]);
    expect(clientIdBuildDrift(['a'], staging, [prod])).toEqual([`missing ${staging}`]);
    expect(clientIdBuildDrift([`${staging} ${prod}`], staging, [prod])).toEqual([
      `holds another environment's ${prod}`,
    ]);
    // Unset here: no client id may be baked in at all.
    expect(clientIdBuildDrift([prod], null, [prod])).toEqual([
      `holds another environment's ${prod}`,
    ]);
    expect(clientIdBuildDrift(['nothing'], null, [prod])).toEqual([]);
  });
});
