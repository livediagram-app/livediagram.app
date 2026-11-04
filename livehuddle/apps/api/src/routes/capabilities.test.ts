import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { resetCallsModeCache } from '../calls/calls-mode';
import { fakeKv } from '../calls/fake-kv';
import { handleCapabilities } from './capabilities';
import { makeTestRouteContext } from './test-route-context';

// GET /api/capabilities reports the optional features the deployment has
// configured, so the app can hide the rest.

async function capabilities(env: Partial<Env>) {
  const res = await handleCapabilities(
    makeTestRouteContext('GET', '/api/capabilities', { env: env as Env }),
  );
  return await res.json<Record<string, unknown>>();
}

describe('the route', () => {
  it('is only GET', async () => {
    const res = await handleCapabilities(
      makeTestRouteContext('POST', '/api/capabilities', { env: {} as Env }),
    );
    expect(res.status).toBe(405);
  });

  it('has nothing beneath it', async () => {
    const res = await handleCapabilities(
      makeTestRouteContext('GET', '/api/capabilities/extra', { env: {} as Env }),
    );
    expect(res.status).toBe(404);
  });
});

describe('the CLI fields (docs/specs/015-api/blueprints/cli.md "Capabilities")', () => {
  it('names the api base, sign-in, the document format, and no issuer or floor by default', async () => {
    const caps = await capabilities({});
    expect(caps).toMatchObject({
      apiBase: expect.stringMatching(/\/api$/),
      authEnabled: false,
      documentFormat: 2,
    });
    expect(caps).not.toHaveProperty('oauthIssuer');
    expect(caps).not.toHaveProperty('cli');
  });

  it('reports sign-in, an https issuer as its origin, and a well-formed version floor', async () => {
    const caps = await capabilities({
      ACCOUNTS_URL: 'https://accounts.example',
      API_RESOURCE: 'https://livehuddle.example/api',
      OAUTH_ISSUER: 'https://mcp.livehuddle.app/',
      CLI_MIN_VERSION: ' 1.2.3 ',
    });
    expect(caps).toMatchObject({
      authEnabled: true,
      oauthIssuer: 'https://mcp.livehuddle.app',
      cli: { minVersion: '1.2.3' },
    });
  });

  it('leaves out an issuer that is not https, or not a URL, and a malformed floor', async () => {
    for (const OAUTH_ISSUER of ['http://mcp.local', 'not a url']) {
      expect(await capabilities({ OAUTH_ISSUER, CLI_MIN_VERSION: '1.2' })).not.toHaveProperty(
        'oauthIssuer',
      );
    }
    expect(await capabilities({ CLI_MIN_VERSION: 'v1' })).not.toHaveProperty('cli');
  });
});

describe('calls (docs/specs/012-collaboration/proximity-audio.md "Turning calls on")', () => {
  const secrets = {
    REALTIME_APP_ID: 'app',
    REALTIME_APP_TOKEN: 'secret',
    TURN_KEY_ID: 'turn',
    TURN_KEY_API_TOKEN: 'turn-secret',
  };

  it('are off with no secrets, on with them, and off on production whatever is set', async () => {
    expect(await capabilities({})).toMatchObject({ callsEnabled: false });
    expect(await capabilities(secrets)).toMatchObject({ callsEnabled: true });
    expect(
      await capabilities({ ...secrets, APP_BASE_URL: 'https://staging.livehuddle.app' }),
    ).toMatchObject({ callsEnabled: true });
    expect(
      await capabilities({ ...secrets, APP_BASE_URL: 'https://www.livehuddle.app' }),
    ).toMatchObject({ callsEnabled: false });
  });

  it('stay shown while the kill switch pauses them, and say the mode', async () => {
    const withMode = (mode: string) => ({
      ...secrets,
      CALLS_SWITCH: fakeKv({ 'calls-mode': mode }),
    });
    resetCallsModeCache();
    expect(await capabilities(withMode('off'))).toMatchObject({
      callsEnabled: true,
      callsMode: 'off',
    });
    resetCallsModeCache();
    expect(await capabilities(withMode('audio-only'))).toMatchObject({
      callsEnabled: true,
      callsMode: 'audio-only',
    });
    resetCallsModeCache();
    expect(await capabilities(secrets)).toMatchObject({ callsMode: 'on' });
    expect(await capabilities({})).not.toHaveProperty('callsMode');
  });
});
