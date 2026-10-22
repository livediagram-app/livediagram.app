import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CliError, type CliFailure } from '../output/cli-error';
import { fakeIo, NOW } from '../testing/fake-io';
import { CAPABILITIES_CACHE_TTL_MS, loadCapabilities } from './capabilities';
import { parseConfig } from './config-file';
import { cacheDir, configDir } from './paths';
import { DEFAULT_HOST, readConfig, resolveProfile } from './profiles';
import { CLI_VERSION, isBelow } from './version';

async function failureOf(fn: () => unknown): Promise<CliFailure> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

const CONFIG = '/home/agent/.config/livediagram/config.toml';

describe('paths', () => {
  it('follow XDG, defaulting under the home directory', () => {
    expect(configDir(fakeIo())).toBe('/home/agent/.config/livediagram');
    expect(cacheDir(fakeIo())).toBe('/home/agent/.cache/livediagram');
    expect(configDir(fakeIo({ env: { XDG_CONFIG_HOME: '/x' } }))).toBe('/x/livediagram');
    expect(cacheDir(fakeIo({ env: { XDG_CACHE_HOME: '/y' } }))).toBe('/y/livediagram');
  });
});

describe('parseConfig', () => {
  it("reads the default profile, telemetry and each profile's host, skipping comments", () => {
    const text = [
      '# livediagram',
      'default_profile = "work"',
      'telemetry = false',
      'unknown = true',
      '',
      '[profiles.work]',
      'host = "https://diagrams.example"  # self-hosted',
      'other = "x"',
      '[profiles.work]',
    ].join('\n');
    expect(parseConfig(text, CONFIG)).toEqual({
      defaultProfile: 'work',
      telemetry: false,
      profiles: { work: { host: 'https://diagrams.example' } },
    });
  });

  it('names the file and line that does not read', async () => {
    expect(await failureOf(() => parseConfig('host = nope', CONFIG))).toMatchObject({
      exit: 2,
      message: `${CONFIG} line 1 does not read: host = nope`,
    });
  });
});

describe('resolveProfile', () => {
  const config = {
    defaultProfile: 'work',
    profiles: {
      work: { host: 'https://diagrams.example/' },
      other: { host: 'https://other.example' },
    },
  };
  const io = (env: Record<string, string> = {}) => fakeIo({ env });

  it('takes --host, then --profile, then LIVEDIAGRAM_HOST, then LIVEDIAGRAM_PROFILE, then the default', () => {
    expect(resolveProfile({ host: 'https://h.example/x' }, io(), config)).toEqual({
      name: 'https://h.example',
      host: 'https://h.example',
      source: 'flag',
    });
    expect(
      resolveProfile({ profile: 'other' }, io({ LIVEDIAGRAM_HOST: 'https://e.example' }), config),
    ).toEqual({ name: 'other', host: 'https://other.example', source: 'flag' });
    expect(
      resolveProfile(
        {},
        io({ LIVEDIAGRAM_HOST: 'https://e.example', LIVEDIAGRAM_PROFILE: 'other' }),
        config,
      ),
    ).toMatchObject({ host: 'https://e.example', source: 'env' });
    expect(resolveProfile({}, io({ LIVEDIAGRAM_PROFILE: 'other' }), config)).toMatchObject({
      name: 'other',
      source: 'env',
    });
    expect(resolveProfile({}, io(), config)).toEqual({
      name: 'work',
      host: 'https://diagrams.example',
      source: 'config',
    });
    expect(resolveProfile({}, io(), { profiles: {} })).toEqual({
      name: 'default',
      host: DEFAULT_HOST,
      source: 'default',
    });
  });

  it('refuses --host with --profile, an unknown profile, and a host that is not a URL', async () => {
    expect(
      await failureOf(() => resolveProfile({ host: 'https://h', profile: 'work' }, io(), config)),
    ).toMatchObject({ exit: 2 });
    expect(await failureOf(() => resolveProfile({ profile: 'nope' }, io(), config))).toMatchObject({
      message: `no profile "nope" in ${CONFIG}`,
    });
    expect(await failureOf(() => resolveProfile({ host: 'diagrams' }, io(), config))).toMatchObject(
      { message: 'diagrams is not a host URL; use https://<host>' },
    );
  });

  it('reads config.toml when it is there', async () => {
    expect(await readConfig(fakeIo())).toEqual({ profiles: {} });
    expect(await readConfig(fakeIo({ files: { [CONFIG]: 'telemetry = true' } }))).toEqual({
      profiles: {},
      telemetry: true,
    });
  });
});

describe('loadCapabilities', () => {
  const profile = { name: 'default', host: DEFAULT_HOST, source: 'default' as const };
  const cache = '/home/agent/.cache/livediagram/capabilities/default.json';
  const answer = {
    aiEnabled: false,
    apiBase: `${DEFAULT_HOST}/api`,
    authEnabled: true,
    oauthIssuer: 'https://mcp.livediagram.app',
    cli: { minVersion: '0.1.0' },
  };

  it('fetches, caches for an hour, and refetches when stale or for another host', async () => {
    const logs: string[] = [];
    const log = (line: string) => void logs.push(line);
    const io = fakeIo({
      routes: [
        (_, url) => (url.pathname === '/api/capabilities' ? Response.json(answer) : undefined),
      ],
    });
    const expected = {
      apiBase: `${DEFAULT_HOST}/api`,
      authEnabled: true,
      oauthIssuer: 'https://mcp.livediagram.app',
      minVersion: '0.1.0',
    };
    expect(await loadCapabilities(io, profile, log)).toEqual(expected);
    expect(await loadCapabilities(io, profile, log)).toEqual(expected);
    expect(io.requests).toHaveLength(1);
    io.fileMap.set(cache, {
      data: JSON.stringify({
        fetchedAt: NOW - CAPABILITIES_CACHE_TTL_MS,
        host: DEFAULT_HOST,
        capabilities: answer,
      }),
      mode: 0o644,
    });
    await loadCapabilities(io, profile, log);
    io.fileMap.set(cache, {
      data: JSON.stringify({ fetchedAt: NOW, host: 'https://other', capabilities: answer }),
      mode: 0o644,
    });
    await loadCapabilities(io, profile, log);
    io.fileMap.set(cache, { data: '{', mode: 0o644 });
    await loadCapabilities(io, profile, log);
    expect(logs).toEqual([
      'capabilities miss',
      'capabilities hit',
      'capabilities stale',
      'capabilities miss',
      'capabilities miss',
    ]);
  });

  it("reads an older worker's answer with the defaults", async () => {
    const io = fakeIo({ routes: [() => Response.json({ aiEnabled: false })] });
    expect(await loadCapabilities(io, profile, () => {})).toEqual({
      apiBase: `${DEFAULT_HOST}/api`,
      authEnabled: false,
    });
  });

  it('refuses a failing host and one that is not livediagram', async () => {
    expect(
      await failureOf(() =>
        loadCapabilities(
          fakeIo({ routes: [() => new Response('x', { status: 502 })] }),
          profile,
          () => {},
        ),
      ),
    ).toMatchObject({
      exit: 7,
      message: `${DEFAULT_HOST} failed (HTTP 502)`,
    });
    expect(
      await failureOf(() =>
        loadCapabilities(fakeIo({ routes: [() => new Response('<html>')] }), profile, () => {}),
      ),
    ).toMatchObject({
      exit: 7,
      code: 'not_livediagram',
    });
  });
});

describe('isBelow', () => {
  it('compares versions part by part', () => {
    expect(isBelow('0.1.0', '0.2.0')).toBe(true);
    expect(isBelow('1.0.0', '0.9.9')).toBe(false);
    expect(isBelow(CLI_VERSION, CLI_VERSION)).toBe(false);
  });

  it('is the package version', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(CLI_VERSION).toBe(pkg.version);
  });
});
