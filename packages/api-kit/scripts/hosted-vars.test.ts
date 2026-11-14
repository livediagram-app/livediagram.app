import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeVersionIds,
  buildEnv,
  hostedEnvironment,
  hostedVarDrift,
  plainVars,
  readHostedProfile,
  resolveHostedVars,
  runHostedVars,
  splitEnvArg,
  unsetVarDrift,
  wranglerVarFlags,
  type HostedProfile,
} from './hosted-vars.mjs';

// The hosted profile's commands and checks, which every product's api binds to its own hosted-vars.json
// (each product's docs/specs/016-platform/deployment.md "Hosted profile"). Each api's own test checks its profile.

describe('hosted-vars script', () => {
  it('renders one --var pair per hosted var', () => {
    expect(wranglerVarFlags({ A: '1', B: 'x:y' })).toEqual(['--var', 'A:1', '--var', 'B:x:y']);
  });

  it('mirrors telemetry into the frontend build, and nothing when it is off', () => {
    expect(buildEnv({ TELEMETRY_ENABLED: 'true', IMAGE_MAX_PER_OWNER: '1' })).toEqual([
      'NEXT_PUBLIC_TELEMETRY_ENABLED=true',
    ]);
    expect(buildEnv({ IMAGE_MAX_PER_OWNER: '1' })).toEqual([]);
    // The frontends send to the same telemetry service as the api.
    expect(
      buildEnv({
        TELEMETRY_URL: 'https://staging.liveworkspace.app/api/telemetry',
      }),
    ).toEqual(['NEXT_PUBLIC_TELEMETRY_URL=https://staging.liveworkspace.app/api/telemetry']);
  });

  it('points the Community pages at the same Community service as the api', () => {
    expect(
      buildEnv({
        COMMUNITY_URL: 'https://staging.liveworkspace.app/api/community',
      }),
    ).toEqual(['NEXT_PUBLIC_COMMUNITY_API=https://staging.liveworkspace.app/api/community']);
  });

  it('rejects a malformed profile rather than deploying half of it', () => {
    const readHostedVars = readHostedProfile;
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

  it('verifies only the versions serving traffic', () => {
    expect(activeVersionIds(status)).toEqual(['v-new']);
    expect(activeVersionIds({})).toEqual([]);
  });

  it('reports every hosted var a deployment lacks or holds with another value', () => {
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

// Some vars are per environment: each deployment's own address and the liveworkspace services it reaches.
describe('hosted profile per environment', () => {
  const prod = 'https://livediagram-router.example.workers.dev';
  const staging = 'https://livediagram-router-staging.example.workers.dev';
  const profile: HostedProfile = {
    shared: { TELEMETRY_ENABLED: 'true' },
    environments: {
      production: { APP_BASE_URL: prod },
      staging: { APP_BASE_URL: staging },
    },
  };

  it('names the environment by the wrangler env, and refuses any other', () => {
    expect(hostedEnvironment('')).toBe('production');
    expect(hostedEnvironment('staging')).toBe('staging');
    expect(() => hostedEnvironment('prod')).toThrow(/unknown environment/);
  });

  it('reads --env off the command line and leaves the rest for wrangler', () => {
    expect(splitEnvArg([])).toEqual({ wranglerEnv: '', rest: [] });
    expect(splitEnvArg(['--env', 'staging', 'out'])).toEqual({
      wranglerEnv: 'staging',
      rest: ['out'],
    });
  });

  it("resolves each environment's own value, shared vars beside it", () => {
    expect(resolveHostedVars(profile, 'staging')).toEqual({
      vars: { TELEMETRY_ENABLED: 'true', APP_BASE_URL: staging },
      unset: [],
    });
    expect(resolveHostedVars(profile, 'production').vars.APP_BASE_URL).toBe(prod);
  });

  it('leaves an empty entry unset: no --var, no build twin', () => {
    const empty: HostedProfile = {
      ...profile,
      environments: { ...profile.environments, staging: { APP_BASE_URL: '' } },
    };
    const { vars, unset } = resolveHostedVars(empty, 'staging');
    expect(unset).toEqual(['APP_BASE_URL']);
    expect(wranglerVarFlags(vars)).toEqual(['--var', 'TELEMETRY_ENABLED:true']);
    expect(buildEnv(vars)).toEqual(['NEXT_PUBLIC_TELEMETRY_ENABLED=true']);
  });

  it('verify fails when a deployment still holds a var this environment leaves unset', () => {
    const deployed = new Map([['APP_BASE_URL', prod]]);
    expect(unsetVarDrift(['APP_BASE_URL'], deployed)).toEqual([
      { name: 'APP_BASE_URL', expected: '(unset)', actual: prod },
    ]);
    expect(unsetVarDrift(['APP_BASE_URL'], new Map())).toEqual([]);
  });
});

describe('runHostedVars', () => {
  afterEach(() => vi.restoreAllMocks());

  const profilePath = () => {
    const dir = mkdtempSync(join(tmpdir(), 'hosted-vars-run-'));
    const path = join(dir, 'hosted-vars.json');
    writeFileSync(
      path,
      JSON.stringify({
        TELEMETRY_ENABLED: 'true',
        environments: {
          production: { APP_BASE_URL: 'https://www.example.app', COMMUNITY_URL: 'https://c.test' },
          staging: { APP_BASE_URL: 'https://staging.example.app', COMMUNITY_URL: '' },
        },
      }),
    );
    return path;
  };
  const capture = () => ({
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  });

  it('prints the wrangler flags and the build twins of an environment', () => {
    const path = profilePath();
    const { log } = capture();
    expect(runHostedVars(['flags', '--env', 'staging'], path)).toBe(0);
    expect(log).toHaveBeenLastCalledWith(
      '--var\nTELEMETRY_ENABLED:true\n--var\nAPP_BASE_URL:https://staging.example.app',
    );
    expect(runHostedVars(['build-env'], path)).toBe(0);
    expect(log).toHaveBeenLastCalledWith(
      'NEXT_PUBLIC_TELEMETRY_ENABLED=true\nNEXT_PUBLIC_COMMUNITY_API=https://c.test',
    );
  });

  it('refuses an unknown command', () => {
    const { error } = capture();
    expect(runHostedVars(['deploy'], profilePath())).toBe(2);
    expect(runHostedVars([], profilePath())).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^usage:/));
  });

  const wrangler =
    (bindings: Record<string, unknown>[], percentage = 100) =>
    (args: string[]) =>
      args[0] === 'deployments'
        ? { versions: [{ version_id: 'v1', percentage }] }
        : { resources: { bindings } };

  it('verify passes when the live version carries every hosted var and none left unset', () => {
    const { log } = capture();
    const calls: string[][] = [];
    const json = (args: string[]) => {
      calls.push(args);
      return wrangler([
        { type: 'plain_text', name: 'TELEMETRY_ENABLED', text: 'true' },
        { type: 'plain_text', name: 'APP_BASE_URL', text: 'https://staging.example.app' },
      ])(args);
    };
    expect(runHostedVars(['verify', '--env', 'staging'], profilePath(), json)).toBe(0);
    expect(calls).toEqual([
      ['deployments', 'status', '--env', 'staging'],
      ['versions', 'view', 'v1', '--env', 'staging'],
    ]);
    expect(log).toHaveBeenCalledWith(
      'hosted-vars verify: ok, TELEMETRY_ENABLED, APP_BASE_URL live on v1',
    );
  });

  it('verify fails on drift, on a var left set, and when nothing serves traffic', () => {
    const { error } = capture();
    const drifted = wrangler([
      { type: 'plain_text', name: 'TELEMETRY_ENABLED', text: 'false' },
      { type: 'plain_text', name: 'APP_BASE_URL', text: 'https://staging.example.app' },
      { type: 'plain_text', name: 'COMMUNITY_URL', text: 'https://c.test' },
    ]);
    expect(runHostedVars(['verify', '--env', 'staging'], profilePath(), drifted)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      'hosted-vars verify: FAILED, version v1 has TELEMETRY_ENABLED=false, expected true',
    );
    expect(error).toHaveBeenCalledWith(
      'hosted-vars verify: FAILED, version v1 has COMMUNITY_URL=https://c.test, expected (unset)',
    );
    expect(runHostedVars(['verify'], profilePath(), wrangler([]))).toBe(1);
    expect(error).toHaveBeenCalledWith(
      'hosted-vars verify: FAILED, version v1 has APP_BASE_URL=(unset), expected https://www.example.app',
    );
    expect(runHostedVars(['verify'], profilePath(), wrangler([], 0))).toBe(1);
    expect(error).toHaveBeenLastCalledWith(
      'hosted-vars verify: FAILED, no version is serving traffic',
    );
  });

  it('reads a profile with no per-environment vars', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hosted-vars-flat-'));
    const path = join(dir, 'vars.json');
    writeFileSync(path, '{"TELEMETRY_ENABLED": "true"}');
    expect(readHostedProfile(path)).toEqual({
      shared: { TELEMETRY_ENABLED: 'true' },
      environments: { production: {}, staging: {} },
    });
  });
});
