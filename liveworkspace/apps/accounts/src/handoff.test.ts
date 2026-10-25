// Signing in on an app's own address (liveworkspace/docs/accounts.md "Signing in on the app's own address"): a real
// Better Auth over an in-memory D1, from an app's authorize request through the sign-in on the app's address to the
// one-time hop that sets the session on liveworkspace.app. The security cases: a token spent twice, a stale one, one
// carried to another browser, a return address that isn't the app's, and redirects that would leave our sites.
import { betterAuth } from 'better-auth';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authOptions } from './auth-options.ts';
import { allAppOrigins } from './auth.ts';
import {
  appOfReturn,
  appOriginOfProxy,
  digest,
  HANDOFF_BIND_PARAM,
  HANDOFF_NONCE_COOKIE,
  HANDOFF_TTL_SECONDS,
  signInOnAppAddress,
} from './handoff.ts';
import { addClient, testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const APP = 'https://livediagram.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const RESOURCE = 'https://livediagram.app/api';
const CALLBACK = `${APP}/api/auth/callback`;
const PLANNER_CALLBACK = 'https://liveplanner.app/api/auth/callback';
const SESSION_COOKIE = '__Secure-better-auth.session_token';

let db: D1Database;
let sql: DatabaseSync;
let codes: Map<string, string>;
let merged: string[];
let auth: ReturnType<typeof build>;

function build() {
  return betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: SECRET,
        resources: [RESOURCE, 'https://liveplanner.app/api'],
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async (email, code) => void codes.set(email, code),
        appOrigins: allAppOrigins('production'),
        handoff: {
          environment: 'production',
          db,
          mergeGuest: async (request, userId) => {
            if (!request.headers.get('cookie')?.includes('lw_guest=')) return false;
            merged.push(userId);
            return true;
          },
        },
      },
      db,
    ),
  );
}

beforeEach(() => {
  ({ db, sql } = testD1());
  const now = new Date().toISOString();
  addClient(sql, 'livediagram-client', 'livediagram.app');
  addClient(sql, 'liveplanner-client', 'liveplanner.app');
  addClient(sql, 'unmapped-client', null);
  const uris = (id: string, list: string[]) =>
    sql
      .prepare(
        'UPDATE oauthClient SET redirectUris = ?, disabled = 0, skipConsent = 1 WHERE clientId = ?',
      )
      .run(JSON.stringify(list), id);
  uris('livediagram-client', [CALLBACK]);
  uris('liveplanner-client', [PLANNER_CALLBACK]);
  uris('unmapped-client', [CALLBACK]);
  for (const resource of [RESOURCE, 'https://liveplanner.app/api']) {
    sql
      .prepare(
        `INSERT INTO oauthResource (id, identifier, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(resource, resource, resource, now, now);
  }
  const link = (clientId: string, resource: string) =>
    sql
      .prepare(
        'INSERT INTO oauthClientResource (id, clientId, resourceId, createdAt) VALUES (?, ?, ?, ?)',
      )
      .run(`${clientId}:${resource}`, clientId, resource, now);
  link('livediagram-client', RESOURCE);
  link('unmapped-client', RESOURCE);
  link('liveplanner-client', 'https://liveplanner.app/api');
  codes = new Map();
  merged = [];
  // Turnstile always passes.
  vi.stubGlobal('fetch', async () => Response.json({ success: true }));
  auth = build();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const handoffEnv = (enabled = true) => ({
  environment: 'production' as const,
  baseUrl: BASE,
  enabled,
  db,
});

function authorizeQuery(clientId = 'livediagram-client', redirectUri = CALLBACK) {
  return new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email offline_access',
    state: 'state-1',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
    resource: clientId === 'liveplanner-client' ? 'https://liveplanner.app/api' : RESOURCE,
  });
}

// GET /oauth2/authorize as the Worker answers it (index.ts): Better Auth, then the sign-in pages' address.
async function authorize(query = authorizeQuery(), enabled = true, cookie?: string) {
  const request = new Request(`${BASE}/api/auth/oauth2/authorize?${query}`, {
    headers: cookie ? { cookie } : {},
  });
  return signInOnAppAddress(request, await auth.handler(request), handoffEnv(enabled));
}

const cookiePairs = (response: Response) =>
  response.headers.getSetCookie().map((c) => c.split(';')[0]!);

// The browser's journey up to the hand-off: authorize, the sign-in page on the app's address, the code.
async function signInOnApp(email = 'ada@example.com') {
  const started = await authorize();
  const page = new URL(started.headers.get('location')!);
  const nonce = cookiePairs(started)
    .find((c) => c.startsWith(`${HANDOFF_NONCE_COOKIE}=`))!
    .slice(HANDOFF_NONCE_COOKIE.length + 1);
  const params = page.searchParams;
  const allowed = new Set(params.getAll('ba_param'));
  const oauthQuery = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'sig' || key === 'ba_param' || allowed.has(key)) oauthQuery.append(key, value);
  }
  // Through the app's router: the request names the app's origin, as the browser on the app's address sends it.
  const json = { 'content-type': 'application/json', origin: APP };
  await auth.handler(
    new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: { ...json, 'x-captcha-response': 'ok' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    }),
  );
  const signedIn = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email-otp`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, otp: codes.get(email), oauth_query: oauthQuery.toString() }),
    }),
  );
  expect(signedIn.status).toBe(200);
  const back = ((await signedIn.json()) as { url: string }).url;
  const session = cookiePairs(signedIn).find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
  return { page, nonce, bind: params.get(HANDOFF_BIND_PARAM)!, back, session };
}

function start(
  session: string,
  body: { return: string; bind: string },
  origin = APP,
): Promise<Response> {
  return auth.handler(
    new Request(`${BASE}/api/auth/handoff/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, cookie: session },
      body: JSON.stringify(body),
    }),
  );
}

async function token(flow: Awaited<ReturnType<typeof signInOnApp>>): Promise<string> {
  const response = await start(flow.session, { return: flow.back, bind: flow.bind });
  expect(response.status).toBe(200);
  const url = new URL(((await response.json()) as { url: string }).url);
  expect(`${url.origin}${url.pathname}`).toBe(`${BASE}/api/auth/handoff`);
  return url.searchParams.get('token')!;
}

const hop = (value: string, cookie?: string) =>
  auth.handler(
    new Request(`${BASE}/api/auth/handoff?token=${encodeURIComponent(value)}`, {
      headers: cookie ? { cookie } : {},
    }),
  );

async function sessionOf(response: Response) {
  const pair = cookiePairs(response).find(
    (c) => c.startsWith(`${SESSION_COOKIE}=`) && !c.endsWith('='),
  );
  if (!pair) return null;
  return auth.api.getSession({ headers: new Headers({ cookie: pair }) });
}

describe('the sign-in pages on the app’s own address', () => {
  it('sends a browser with no session to the app’s /sign-in, with a nonce here and its hash in the query', async () => {
    const response = await authorize();
    expect(response.status).toBe(302);
    const page = new URL(response.headers.get('location')!);
    expect(page.origin).toBe(APP);
    expect(page.pathname).toBe('/sign-in');
    expect(page.searchParams.get('sig')).toBeTruthy();
    const set = response.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${HANDOFF_NONCE_COOKIE}=`))!;
    expect(set).toMatch(/Path=\/api\/auth\/handoff;/);
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/Secure/);
    const nonce = set.split(';')[0]!.slice(HANDOFF_NONCE_COOKIE.length + 1);
    expect(page.searchParams.get(HANDOFF_BIND_PARAM)).toBe(await digest(nonce));
  });

  it('keeps the pages on liveworkspace.app when switched off, or for a client that is no app', async () => {
    const off = await authorize(authorizeQuery(), false);
    expect(new URL(off.headers.get('location')!, BASE).origin).toBe(BASE);
    expect(off.headers.getSetCookie().some((c) => c.startsWith(HANDOFF_NONCE_COOKIE))).toBe(false);
    const unmapped = await authorize(authorizeQuery('unmapped-client'));
    expect(new URL(unmapped.headers.get('location')!, BASE).origin).toBe(BASE);
  });

  it('never sends a sign-in to an address the client did not register', async () => {
    const response = await authorize(
      authorizeQuery('livediagram-client', 'https://evil.example/cb'),
    );
    const location = response.headers.get('location') ?? '';
    expect(location).not.toContain('evil.example');
    expect(response.headers.getSetCookie().some((c) => c.startsWith(HANDOFF_NONCE_COOKIE))).toBe(
      false,
    );
  });

  it('leaves a browser that is signed in alone: straight back with a code, as before', async () => {
    const flow = await signInOnApp();
    const response = await authorize(authorizeQuery(), true, flow.session);
    const location = new URL(response.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
    expect(location.searchParams.get('code')).toBeTruthy();
  });
});

describe('the hand-off', () => {
  it('sets the session on liveworkspace.app and goes on to the app’s callback with its code', async () => {
    const flow = await signInOnApp();
    const minted = await start(flow.session, { return: flow.back, bind: flow.bind });
    // The session's cookie leaves the app's address as the hand-off is made.
    expect(minted.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toMatch(
      /Max-Age=0/,
    );
    const value = new URL(((await minted.json()) as { url: string }).url).searchParams.get(
      'token',
    )!;
    const response = await hop(value, `${HANDOFF_NONCE_COOKIE}=${flow.nonce}`);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(flow.back);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const session = await sessionOf(response);
    expect(session?.user.email).toBe('ada@example.com');
    // The same session the code was made in, so the app's code swap and every app's tokens hang off it.
    expect(cookiePairs(response).find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(
      flow.session,
    );
    // The nonce is spent too.
    expect(
      response.headers.getSetCookie().find((c) => c.startsWith(`${HANDOFF_NONCE_COOKIE}=`)),
    ).toMatch(/Max-Age=0/);
  });

  it('keeps only the token’s hash', async () => {
    const value = await token(await signInOnApp());
    const rows = sql.prepare('SELECT * FROM sign_in_handoff').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(value);
    expect(rows[0]!.tokenHash).toBe(await digest(value));
  });

  it('hands a guest’s things to the account at the hop', async () => {
    const flow = await signInOnApp();
    const response = await hop(
      await token(flow),
      `${HANDOFF_NONCE_COOKIE}=${flow.nonce}; lw_guest=g.sig`,
    );
    expect(response.status).toBe(302);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe((await sessionOf(response))?.user.id);
    expect(response.headers.getSetCookie().find((c) => c.startsWith('lw_guest='))).toMatch(
      /Max-Age=0/,
    );
  });

  it('refuses a token spent once already (replay)', async () => {
    const flow = await signInOnApp();
    const value = await token(flow);
    const cookie = `${HANDOFF_NONCE_COOKIE}=${flow.nonce}`;
    expect((await hop(value, cookie)).status).toBe(302);
    const again = await hop(value, cookie);
    expect(again.status).toBe(400);
    expect(await sessionOf(again)).toBeNull();
    expect(again.headers.get('location')).toBeNull();
  });

  it('refuses a token after its minute (expiry)', async () => {
    const flow = await signInOnApp();
    const value = await token(flow);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + (HANDOFF_TTL_SECONDS + 1) * 1000);
    const late = await hop(value, `${HANDOFF_NONCE_COOKIE}=${flow.nonce}`);
    expect(late.status).toBe(400);
    expect(await sessionOf(late)).toBeNull();
  });

  it('refuses a token carried to another browser, and spends it so the thief can’t retry', async () => {
    const flow = await signInOnApp();
    const value = await token(flow);
    const thief = await hop(value);
    expect(thief.status).toBe(400);
    expect(await sessionOf(thief)).toBeNull();
    const other = await hop(
      value,
      `${HANDOFF_NONCE_COOKIE}=someone-elses-nonce-entirely-000000000000`,
    );
    expect(other.status).toBe(400);
    // Even the right browser can't use it now: one try per token.
    expect((await hop(value, `${HANDOFF_NONCE_COOKIE}=${flow.nonce}`)).status).toBe(400);
  });

  it('refuses a made-up token', async () => {
    expect((await hop('x'.repeat(43))).status).toBe(400);
    expect((await hop('not a token')).status).toBe(400);
    expect((await hop('')).status).toBe(400);
  });

  it.each([
    ['another site', 'https://evil.example/api/auth/callback?code=c'],
    ['a look-alike host', 'https://livediagram.app.evil.example/api/auth/callback?code=c'],
    ['a sub-domain', 'https://evil.livediagram.app/api/auth/callback?code=c'],
    ['plain http', 'http://livediagram.app/api/auth/callback?code=c'],
    ['a path the app did not register', 'https://livediagram.app/sign-in?code=c'],
    ['another app’s callback', `${PLANNER_CALLBACK}?code=c`],
    ['a local address in production', 'http://localhost:3100/api/auth/callback?code=c'],
    ['credentials in the address', 'https://user:pass@livediagram.app/api/auth/callback?code=c'],
    ['a fragment', 'https://livediagram.app/api/auth/callback?code=c#x'],
    ['a protocol-relative address', '//evil.example/api/auth/callback'],
    ['a javascript: address', 'javascript:alert(1)'],
  ])('refuses a return address that is %s (foreign return, open redirect)', async (_, back) => {
    const flow = await signInOnApp();
    const response = await start(flow.session, { return: back, bind: flow.bind });
    expect(response.status).toBe(400);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM sign_in_handoff').get()).toEqual({ n: 0 });
    // And the session's cookie still leaves the app's address.
    expect(response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toMatch(
      /Max-Age=0/,
    );
  });

  it('is made only for a page on an app’s own address, with a session, bound to a nonce', async () => {
    const flow = await signInOnApp();
    const body = { return: flow.back, bind: flow.bind };
    // liveworkspace.app itself, and anywhere else, aren't the app's pages.
    expect((await start(flow.session, body, BASE)).status).toBe(403);
    expect((await start(flow.session, body, 'https://evil.example')).status).toBe(403);
    expect((await start('', body)).status).toBe(401);
    expect((await start(flow.session, { return: flow.back, bind: 'short' })).status).toBe(400);
  });
});

describe('where a sign-in may go back to', () => {
  it('is a registered redirect URI of the app’s client, on the app’s own origin in this environment', async () => {
    expect(await appOfReturn(db, 'production', `${CALLBACK}?code=c&state=s`)).toBe(
      'livediagram.app',
    );
    expect(await appOfReturn(db, 'production', CALLBACK, 'livediagram-client')).toBe(
      'livediagram.app',
    );
    // The right address under another app's client is not this app's.
    expect(await appOfReturn(db, 'production', CALLBACK, 'liveplanner-client')).toBeNull();
    expect(await appOfReturn(db, 'staging', CALLBACK)).toBeNull();
  });
});

describe('the app origin a request came through', () => {
  const proxied = (host: string, named = true) =>
    new Request(`${BASE}/api/auth/sign-in/social`, {
      headers: {
        'x-forwarded-host': host,
        ...(named && { 'x-liveworkspace-proxy': 'livediagram' }),
      },
    });

  it('is the forwarded host when an app’s router forwarded it and the host is an app’s', () => {
    expect(appOriginOfProxy(proxied('livediagram.app'), 'production')).toBe(APP);
    expect(appOriginOfProxy(proxied('localhost:3100'), 'development')).toBe(
      'http://localhost:3100',
    );
    expect(appOriginOfProxy(proxied('evil.example'), 'production')).toBeNull();
    expect(appOriginOfProxy(proxied('livediagram.app', false), 'production')).toBeNull();
  });
});
