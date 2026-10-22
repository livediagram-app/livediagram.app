import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { handleCapabilities } from './capabilities';
import { makeTestRouteContext } from './test-route-context';

// GET /api/capabilities reports the optional features the deployment has
// configured, so the app can hide the rest.

async function capabilities(env: Partial<Env>) {
  const res = handleCapabilities(
    makeTestRouteContext('GET', '/api/capabilities', { env: env as Env }),
  );
  return await res.json<Record<string, unknown>>();
}

describe('the route', () => {
  it('is only GET', () => {
    const res = handleCapabilities(
      makeTestRouteContext('POST', '/api/capabilities', { env: {} as Env }),
    );
    expect(res.status).toBe(405);
  });

  it('has nothing beneath it', () => {
    const res = handleCapabilities(
      makeTestRouteContext('GET', '/api/capabilities/extra', { env: {} as Env }),
    );
    expect(res.status).toBe(404);
  });
});

describe('the CLI fields (docs/specs/015-api/blueprints/cli.md "Capabilities")', () => {
  it('names the api base, sign-in, the project format, and no issuer or floor by default', async () => {
    const caps = await capabilities({});
    expect(caps).toMatchObject({
      apiBase: expect.stringMatching(/\/api$/),
      authEnabled: false,
      projectFormat: 2,
    });
    expect(caps).not.toHaveProperty('oauthIssuer');
    expect(caps).not.toHaveProperty('cli');
  });

  it('reports sign-in, an https issuer as its origin, and a well-formed version floor', async () => {
    const caps = await capabilities({
      ACCOUNTS_URL: 'https://accounts.example',
      API_RESOURCE: 'https://liveplanner.example/api',
      OAUTH_ISSUER: 'https://mcp.liveplanner.app/',
      CLI_MIN_VERSION: ' 1.2.3 ',
    });
    expect(caps).toMatchObject({
      authEnabled: true,
      oauthIssuer: 'https://mcp.liveplanner.app',
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
