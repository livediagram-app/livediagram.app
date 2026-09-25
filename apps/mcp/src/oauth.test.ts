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

// Start a real authorize and hand back its session id — the same value the
// consent screen receives in its URL.
async function startAuthorize(clientId: string): Promise<string> {
  const challenge = await __test.sha256base64url('x'.repeat(64));
  const auth = await app.request(
    `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}` +
      `&code_challenge=${challenge}&response_type=code`,
    {},
    env,
  );
  expect(auth.status).toBe(302);
  return new URL(auth.headers.get('location')!).searchParams.get('session')!;
}

describe('GET /oauth/session/:id (what the consent screen may believe)', () => {
  // The consent screen's one anti-phishing line names the host a full-access
  // token is about to reach. /oauth/authorize also passes that host as a query
  // param, and the screen used to render THAT — forgeable by anyone who can
  // write a URL, which is precisely the party the line exists to expose. This
  // endpoint answers from the stored session, where the redirect URI was
  // checked against the client's registered list before being written.
  it('reports the registered redirect host and the client name', async () => {
    const session = await startAuthorize(await register());
    const res = await app.request(`/oauth/session/${session}`, {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientName: 'Claude', redirectHost: 'client.test' });
  });

  it('404s an unknown or expired session', async () => {
    const res = await app.request('/oauth/session/nope', {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'invalid_session' });
  });

  it('leaks no token, code or PKCE material', async () => {
    const session = await startAuthorize(await register());
    const body = (await (await app.request(`/oauth/session/${session}`, {}, env)).json()) as Record<
      string,
      unknown
    >;
    expect(Object.keys(body).sort()).toEqual(['clientName', 'redirectHost']);
    expect(JSON.stringify(body)).not.toContain('code_challenge');
  });

  it('does not consume the session — /oauth/complete still works after a read', async () => {
    const session = await startAuthorize(await register());
    expect((await app.request(`/oauth/session/${session}`, {}, env)).status).toBe(200);
    const comp = await app.request(
      '/oauth/complete',
      {
        method: 'POST',
        body: JSON.stringify({ session, token: 'lvd_secret' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    expect(comp.status).toBe(200);
  });

  it('reports the REGISTERED host even when the client name is attacker-chosen', async () => {
    // Registration is open by design, so `client_name` is never a trust signal.
    // The host is, and it comes from the validated redirect_uri regardless of
    // what the client called itself.
    const res = await app.request(
      '/oauth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['https://evil.test/cb'],
          client_name: 'Notion',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    );
    const { client_id } = (await res.json()) as { client_id: string };
    const session = await app.request(
      `/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent('https://evil.test/cb')}` +
        `&code_challenge=${await __test.sha256base64url('x'.repeat(64))}&response_type=code`,
      {},
      env,
    );
    const id = new URL(session.headers.get('location')!).searchParams.get('session')!;
    const body = await (await app.request(`/oauth/session/${id}`, {}, env)).json();
    expect(body).toEqual({ clientName: 'Notion', redirectHost: 'evil.test' });
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
