import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from './env';
import { __test, registerOauthRoutes } from './oauth';

function mockKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    get: async (k: string, type?: string) => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => {
      m.set(k, v);
    },
    delete: async (k: string) => {
      m.delete(k);
    },
  } as unknown as KVNamespace;
}

let app: Hono<{ Bindings: Env }>;
let env: Env;

beforeEach(() => {
  app = new Hono<{ Bindings: Env }>();
  registerOauthRoutes(app);
  env = { OAUTH_KV: mockKV(), API: {} as Fetcher, CONSENT_BASE_URL: 'https://live.test' };
});

const REDIRECT = 'https://client.test/cb';

async function register(): Promise<string> {
  const res = await app.request(
    '/oauth/register',
    {
      method: 'POST',
      body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: 'Claude' }),
      headers: { 'Content-Type': 'application/json' },
    },
    env,
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

describe('discovery', () => {
  it('advertises S256 + none auth + the endpoints', async () => {
    const res = await app.request('/.well-known/oauth-authorization-server', {}, env);
    const meta = (await res.json()) as Record<string, unknown>;
    expect(meta.code_challenge_methods_supported).toEqual(['S256']);
    expect(meta.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(meta.registration_endpoint).toContain('/oauth/register');
  });
});

describe('dynamic client registration', () => {
  it('rejects a non-https redirect uri', async () => {
    const res = await app.request(
      '/oauth/register',
      {
        method: 'POST',
        body: JSON.stringify({ redirect_uris: ['http://evil.test/cb'] }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    expect(res.status).toBe(400);
  });
  it('allows localhost for dev', async () => {
    const res = await app.request(
      '/oauth/register',
      {
        method: 'POST',
        body: JSON.stringify({ redirect_uris: ['http://localhost:1234/cb'] }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    expect(res.status).toBe(201);
  });

  it('rate-limits registration per IP', async () => {
    const reqOnce = () =>
      app.request(
        '/oauth/register',
        {
          method: 'POST',
          body: JSON.stringify({ redirect_uris: [REDIRECT] }),
          headers: { 'Content-Type': 'application/json' },
        },
        env,
      );
    for (let i = 0; i < 20; i++) expect((await reqOnce()).status).toBe(201);
    expect((await reqOnce()).status).toBe(429);
  });
});

describe('full authorize -> complete -> token flow', () => {
  it('round-trips a PKCE code to the minted token', async () => {
    const clientId = await register();
    const verifier = 'x'.repeat(64);
    const challenge = await __test.sha256base64url(verifier);

    const auth = await app.request(
      `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}` +
        `&code_challenge=${challenge}&code_challenge_method=S256&state=st8&response_type=code`,
      {},
      env,
    );
    expect(auth.status).toBe(302);
    const session = new URL(auth.headers.get('location')!).searchParams.get('session')!;
    expect(session).toBeTruthy();

    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 180;
    const comp = await app.request(
      '/oauth/complete',
      {
        method: 'POST',
        body: JSON.stringify({ session, token: 'lvd_secret', expiresAt }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    const { redirectTo } = (await comp.json()) as { redirectTo: string };
    const redirect = new URL(redirectTo);
    expect(redirect.searchParams.get('state')).toBe('st8');
    const code = redirect.searchParams.get('code')!;

    const tok = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: REDIRECT,
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      env,
    );
    const token = (await tok.json()) as { access_token: string; expires_in: number };
    expect(token.access_token).toBe('lvd_secret');
    // expires_in reflects the ~6-month token life (spec/62 §3.5).
    expect(token.expires_in).toBeGreaterThan(60 * 60 * 24 * 179);
  });

  it('rejects a wrong PKCE verifier and a reused code', async () => {
    const clientId = await register();
    const verifier = 'y'.repeat(64);
    const challenge = await __test.sha256base64url(verifier);
    const auth = await app.request(
      `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256`,
      {},
      env,
    );
    const session = new URL(auth.headers.get('location')!).searchParams.get('session')!;
    const comp = await app.request(
      '/oauth/complete',
      {
        method: 'POST',
        body: JSON.stringify({ session, token: 'lvd_secret' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    const code = new URL(
      ((await comp.json()) as { redirectTo: string }).redirectTo,
    ).searchParams.get('code')!;

    const bad = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: 'w'.repeat(64), // valid length, wrong value
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      env,
    );
    expect(((await bad.json()) as { error: string }).error).toBe('invalid_grant');

    // The code was burned even on the failed attempt — a correct retry now fails.
    const retry = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      env,
    );
    expect(((await retry.json()) as { error: string }).error).toBe('invalid_grant');
  });

  it('rejects authorize for an unregistered redirect uri', async () => {
    const clientId = await register();
    const res = await app.request(
      `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent('https://other.test/cb')}&code_challenge=${'a'.repeat(43)}`,
      {},
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects a too-short PKCE challenge and a too-short verifier', async () => {
    const clientId = await register();
    // authorize: short challenge.
    const shortChallenge = await app.request(
      `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=short`,
      {},
      env,
    );
    expect(shortChallenge.status).toBe(400);

    // token: short verifier against a valid code.
    const verifier = 'z'.repeat(64);
    const challenge = await __test.sha256base64url(verifier);
    const auth = await app.request(
      `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}`,
      {},
      env,
    );
    const session = new URL(auth.headers.get('location')!).searchParams.get('session')!;
    const comp = await app.request(
      '/oauth/complete',
      {
        method: 'POST',
        body: JSON.stringify({ session, token: 'lvd_x' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    const code = new URL(
      ((await comp.json()) as { redirectTo: string }).redirectTo,
    ).searchParams.get('code')!;
    const tok = await app.request(
      '/oauth/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: 'tooshort',
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      env,
    );
    expect(((await tok.json()) as { error: string }).error).toBe('invalid_request');
  });
});
