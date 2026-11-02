import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The hosted profile (docs/specs/016-platform/deployment.md "Hosted profile"):
// the vars livedocuments.app's deploys add, and a fork's do not. Two promises
// hang on it: a fork deploying the repo as documented is telemetry-off, and
// the hosted deployment's vars survive every deploy.

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
  it('turns telemetry on and points each environment at its media and Community services', async () => {
    const { shared, environments } = (await load()).readHostedProfile();
    expect(shared.TELEMETRY_ENABLED).toBe('true');
    expect(environments.production.MEDIA_URL).toBe('https://www.liveworkspace.app/api/media');
    expect(environments.staging.MEDIA_URL).toBe('https://staging.liveworkspace.app/api/media');
    expect(environments.production.COMMUNITY_URL).toBe(
      'https://www.liveworkspace.app/api/community',
    );
    expect(environments.staging.COMMUNITY_URL).toBe(
      'https://staging.liveworkspace.app/api/community',
    );
  });

  it('names only vars the worker reads', async () => {
    const types = readApiFile('src/types.ts');
    const { shared, environments } = (await load()).readHostedProfile();
    const names = [...Object.keys(shared), ...Object.keys(environments.production)];
    for (const name of names) {
      expect(types, `${name} is not on Env`).toMatch(new RegExp(`\\b${name}\\?: string;`));
    }
  });

  it('is never a committed default, so a fork is telemetry-off', async () => {
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
    expect(tomlTableKeys(toml, 'vars')).toContain('INDEX_ORIGIN');
    expect(tomlTableKeys(toml, 'env.staging.vars')).toContain('INDEX_ORIGIN');
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
    expect(buildEnv({ TELEMETRY_ENABLED: 'true', TELEMETRY_URL: 'https://t.test' })).toEqual([
      'NEXT_PUBLIC_TELEMETRY_ENABLED=true',
      'NEXT_PUBLIC_TELEMETRY_URL=https://t.test',
    ]);
    expect(buildEnv({ IMAGE_MAX_PER_OWNER: '1' })).toEqual([]);
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
        { type: 'secret_text', name: 'ACCOUNTS_CLIENT_SECRET' },
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

// Some hosted vars are per environment: livedocuments.app's production and staging
// each carry their own value (docs/specs/016-platform/deployment.md "Hosted profile").
describe('hosted profile per environment', () => {
  const PROD = 'https://www.livedocuments.app';
  const STAGING = 'https://staging.livedocuments.app';
  const profile: Profile = {
    shared: { TELEMETRY_ENABLED: 'true' },
    environments: {
      production: { APP_BASE_URL: PROD },
      staging: { APP_BASE_URL: STAGING },
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

  it("resolves each environment's own value, shared vars beside it", async () => {
    const { resolveHostedVars } = await load();
    expect(resolveHostedVars(profile, 'staging')).toEqual({
      vars: { TELEMETRY_ENABLED: 'true', APP_BASE_URL: STAGING },
      unset: [],
    });
    expect(resolveHostedVars(profile, 'production').vars.APP_BASE_URL).toBe(PROD);
  });

  it('leaves an empty entry unset: no --var for it', async () => {
    const { resolveHostedVars, wranglerVarFlags } = await load();
    const empty: Profile = {
      ...profile,
      environments: { ...profile.environments, staging: { APP_BASE_URL: '' } },
    };
    const { vars, unset } = resolveHostedVars(empty, 'staging');
    expect(unset).toEqual(['APP_BASE_URL']);
    expect(wranglerVarFlags(vars)).toEqual(['--var', 'TELEMETRY_ENABLED:true']);
  });

  it('verify fails when a deployment still holds a var this environment leaves unset', async () => {
    const { unsetVarDrift } = await load();
    const deployed = new Map([['APP_BASE_URL', PROD]]);
    expect(unsetVarDrift(['APP_BASE_URL'], deployed)).toEqual([
      { name: 'APP_BASE_URL', expected: '(unset)', actual: PROD },
    ]);
    expect(unsetVarDrift(['APP_BASE_URL'], new Map())).toEqual([]);
  });
});
