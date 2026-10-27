// Signing out everywhere (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"): a real Better Auth over an
// in-memory D1, two apps registered as the Worker registers them, signed in from one browser session with a real code
// flow, then signed out from an app's Worker, from the browser's hop and from liveworkspace.app itself.
import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { authOptions } from './auth-options.ts';
import type { Auth } from './auth.ts';
import { registerClient } from './clients.ts';
import {
  allowedReturn,
  endSessionFromApp,
  endSessionInBrowser,
  endSessionTokensOf,
  readTicket,
  REDIRECT_MAX_LENGTH,
  signTicket,
  TICKET_TTL_SECONDS,
} from './end-session.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';
import { testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';

type App = { clientId: string; secret: string; callback: string; resource: string };

let env: Env;
let auth: Auth;
let sql: DatabaseSync;
let codes: Map<string, string>;
let diagram: App;
let planner: App;

async function register(app: 'livediagram.app' | 'liveplanner.app'): Promise<App> {
  const callback = `https://${app}/api/auth/callback`;
  const resource = `https://${app}/api`;
  const response = await registerClient(
    new Request(`${BASE}/api/auth/internal/clients`, {
      method: 'POST',
      headers: { authorization: 'Bearer admin', 'content-type': 'application/json' },
      body: JSON.stringify({ name: app, redirectUris: [callback], resource, app }),
    }),
    env,
    auth,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { client_id: string; client_secret: string };
  return { clientId: body.client_id, secret: body.client_secret, callback, resource };
}

beforeEach(async () => {
  const made = testD1();
  sql = made.sql;
  codes = new Map();
  // Turnstile always passes.
  vi.stubGlobal('fetch', async () => Response.json({ success: true }));
  env = {
    ENVIRONMENT: 'production',
    BASE_URL: BASE,
    BETTER_AUTH_SECRET: SECRET,
    ADMIN_TOKEN: 'admin',
    AUTH_DB: made.db,
  } as unknown as Env;
  auth = betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: SECRET,
        resources: RESOURCES.production,
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async (email, code) => void codes.set(email, code),
      },
      made.db,
    ),
  ) as unknown as Auth;
  diagram = await register('livediagram.app');
  planner = await register('liveplanner.app');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A browser session on liveworkspace.app: its cookies, as the browser sends them back.
async function signIn(email = 'ada@example.com'): Promise<string> {
  const json = { 'content-type': 'application/json', origin: BASE };
  await auth.handler(
    new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: { ...json, 'x-captcha-response': 'ok' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    }),
  );
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email-otp`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, otp: codes.get(email) }),
    }),
  );
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

const basic = (app: App, secret = app.secret) =>
  `Basic ${btoa(`${encodeURIComponent(app.clientId)}:${encodeURIComponent(secret)}`)}`;

async function tokenRequest(app: App, params: Record<string, string>): Promise<Response> {
  return auth.handler(
    new Request(`${BASE}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: basic(app),
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
    }),
  );
}

// The app's sign-in as its Worker runs it: authorize with the browser's session, then the code for tokens.
async function signInToApp(app: App, cookie: string): Promise<string> {
  const verifier = 'v'.repeat(43);
  const challenge = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  ).toString('base64url');
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: app.clientId,
    redirect_uri: app.callback,
    scope: 'openid profile email offline_access',
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: app.resource,
  });
  const authorized = await auth.handler(
    new Request(`${BASE}/api/auth/oauth2/authorize?${query}`, { headers: { cookie } }),
  );
  const location =
    authorized.headers.get('location') ?? ((await authorized.json()) as { url?: string }).url ?? '';
  const code = new URL(location).searchParams.get('code');
  expect(code).toBeTruthy();
  const tokens = await tokenRequest(app, {
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: app.callback,
    code_verifier: verifier,
    resource: app.resource,
  });
  expect(tokens.status).toBe(200);
  const { refresh_token } = (await tokens.json()) as { refresh_token: string };
  return refresh_token;
}

// Whether the app's next refresh would still work (a fresh call each time, so the token is not rotated away).
async function refreshes(app: App, refreshToken: string): Promise<boolean> {
  const response = await tokenRequest(app, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    resource: app.resource,
  });
  return response.status === 200;
}

const sessionOf = (cookie: string) =>
  auth.api.getSession({ headers: new Headers({ cookie }) }).catch(() => null);

function fromApp(app: App, token: unknown, secret?: string) {
  return endSessionFromApp(
    new Request(`${BASE}/api/auth/end-session`, {
      method: 'POST',
      headers: { authorization: basic(app, secret), 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }),
    env,
    auth,
  );
}

function hop(params: Record<string, string>, cookie?: string) {
  return endSessionInBrowser(
    new Request(`${BASE}/api/auth/end-session?${new URLSearchParams(params)}`, {
      headers: cookie ? { cookie } : {},
    }),
    env,
    auth,
  );
}

const count = (table: string) =>
  (sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("signing out from an app's Worker", () => {
  it("ends the browser's session and every app's session from it, and answers a ticket", async () => {
    const cookie = await signIn();
    const diagramToken = await signInToApp(diagram, cookie);
    const plannerToken = await signInToApp(planner, cookie);
    // Another browser of the same account stays signed in.
    const elsewhere = await signIn();
    const elsewhereToken = await signInToApp(planner, elsewhere);

    const response = await fromApp(diagram, diagramToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as { ended: boolean; ticket: string };
    expect(body.ended).toBe(true);
    const ticket = await readTicket(body.ticket, SECRET);
    const user = (await sessionOf(elsewhere))!.user.id;
    expect(ticket).toMatchObject({ c: diagram.clientId, s: user });
    expect(ticket!.e - Date.now() / 1000).toBeGreaterThan(TICKET_TTL_SECONDS - 5);

    expect(await sessionOf(cookie)).toBeNull();
    expect(await refreshes(diagram, diagramToken)).toBe(false);
    expect(await refreshes(planner, plannerToken)).toBe(false);
    expect(await sessionOf(elsewhere)).not.toBeNull();
    expect(await refreshes(planner, elsewhereToken)).toBe(true);
  });

  it('deletes the tokens rather than revoking them, so no other device loses its own', async () => {
    const cookie = await signIn();
    const plannerToken = await signInToApp(planner, cookie);
    const other = await signInToApp(planner, await signIn());
    await fromApp(planner, plannerToken);
    // A deleted token shown again is unknown; a revoked one would take the account's whole family with it.
    expect(await refreshes(planner, plannerToken)).toBe(false);
    expect(await refreshes(planner, other)).toBe(true);
  });

  it('ends only its own token when its session has gone already', async () => {
    const cookie = await signIn();
    const diagramToken = await signInToApp(diagram, cookie);
    sql.prepare('DELETE FROM session').run();
    const response = await fromApp(diagram, diagramToken);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { ended: boolean }).ended).toBe(false);
    expect(count('oauthRefreshToken')).toBe(0);
  });

  it('refuses a wrong secret, another app’s token, and a request missing either', async () => {
    const cookie = await signIn();
    const diagramToken = await signInToApp(diagram, cookie);
    expect((await fromApp(diagram, diagramToken, 'wrong')).status).toBe(401);
    const foreign = await fromApp(planner, diagramToken);
    expect(foreign.status).toBe(401);
    expect(await foreign.json()).toEqual({ error: 'invalid_token' });
    expect((await fromApp(diagram, 'not-a-token')).status).toBe(401);
    expect((await fromApp(diagram, 42)).status).toBe(400);
    const noAuth = await endSessionFromApp(
      new Request(`${BASE}/api/auth/end-session`, { method: 'POST', body: 'null' }),
      env,
      auth,
    );
    expect(noAuth.status).toBe(400);
    expect(await sessionOf(cookie)).not.toBeNull();
    expect(await refreshes(diagram, diagramToken)).toBe(true);
  });
});

describe("the browser's hop", () => {
  const BACK = 'https://livediagram.app/';

  async function ticketFor(app: App, cookie: string) {
    const user = (await sessionOf(cookie))!.user.id;
    return signTicket({ c: app.clientId, s: user, e: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  }

  it("ends a newer session of the same account, with its apps' tokens, and clears the cookie", async () => {
    // The app signed in on an older session; the browser has signed in again since.
    const older = await signIn();
    const diagramToken = await signInToApp(diagram, older);
    const cookie = await signIn();
    const plannerToken = await signInToApp(planner, cookie);
    const { ticket } = (await (await fromApp(diagram, diagramToken)).json()) as { ticket: string };
    expect(await sessionOf(cookie)).not.toBeNull();

    const response = await hop(
      { client_id: diagram.clientId, post_logout_redirect_uri: `${BACK}explorer?x=1`, ticket },
      cookie,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${BACK}explorer?x=1`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const cleared = response.headers.getSetCookie().find((c) => c.includes('session_token='));
    expect(cleared).toMatch(/Max-Age=0/);
    expect(await sessionOf(cookie)).toBeNull();
    expect(await refreshes(planner, plannerToken)).toBe(false);
    expect(count('session')).toBe(0);
  });

  it('clears the cookie of a session the app’s Worker already ended', async () => {
    const cookie = await signIn();
    const { ticket } = (await (
      await fromApp(diagram, await signInToApp(diagram, cookie))
    ).json()) as {
      ticket: string;
    };
    const response = await hop(
      { client_id: diagram.clientId, post_logout_redirect_uri: BACK, ticket },
      cookie,
    );
    expect(response.status).toBe(302);
    expect(response.headers.getSetCookie().some((c) => c.includes('session_token='))).toBe(true);
  });

  it('ends nothing without a ticket, with a forged, stale or other app’s one, or for another account', async () => {
    const cookie = await signIn();
    const plannerToken = await signInToApp(planner, cookie);
    const user = (await sessionOf(cookie))!.user.id;
    const now = Math.floor(Date.now() / 1000);
    const tickets = [
      undefined,
      'nonsense',
      `${(await ticketFor(diagram, cookie)).split('.')[0]}.AAAA`,
      await signTicket({ c: diagram.clientId, s: user, e: now - 1 }, SECRET),
      await signTicket(
        { c: diagram.clientId, s: user, e: now + 60 },
        'another-secret-of-32-characters!!',
      ),
      await signTicket({ c: planner.clientId, s: user, e: now + 60 }, SECRET),
      await signTicket({ c: diagram.clientId, s: 'user_someone_else', e: now + 60 }, SECRET),
    ];
    for (const ticket of tickets) {
      const response = await hop(
        {
          client_id: diagram.clientId,
          post_logout_redirect_uri: BACK,
          ...(ticket ? { ticket } : {}),
        },
        cookie,
      );
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(BACK);
      expect(response.headers.getSetCookie()).toEqual([]);
    }
    expect(await sessionOf(cookie)).not.toBeNull();
    expect(await refreshes(planner, plannerToken)).toBe(true);
  });

  it('refuses an unknown client or an address off its registered origins, going nowhere', async () => {
    const cookie = await signIn();
    const ticket = await ticketFor(diagram, cookie);
    const refused: [Record<string, string>, string][] = [
      [{ client_id: 'nobody', post_logout_redirect_uri: BACK, ticket }, 'invalid_client'],
      [{ post_logout_redirect_uri: BACK, ticket }, 'invalid_client'],
      [{ client_id: diagram.clientId, ticket }, 'invalid_redirect_uri'],
      [
        { client_id: diagram.clientId, post_logout_redirect_uri: 'https://evil.example/', ticket },
        'invalid_redirect_uri',
      ],
      [
        // Another app's origin is not this client's.
        {
          client_id: diagram.clientId,
          post_logout_redirect_uri: 'https://liveplanner.app/',
          ticket,
        },
        'invalid_redirect_uri',
      ],
      [
        {
          client_id: diagram.clientId,
          post_logout_redirect_uri: 'https://livediagram.app.evil.example/',
          ticket,
        },
        'invalid_redirect_uri',
      ],
    ];
    for (const [params, error] of refused) {
      const response = await hop(params, cookie);
      expect(response.status).toBe(400);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ error });
    }
    expect(await sessionOf(cookie)).not.toBeNull();
  });

  it('refuses a disabled client', async () => {
    sql.prepare('UPDATE oauthClient SET disabled = 1 WHERE clientId = ?').run(diagram.clientId);
    const response = await hop({ client_id: diagram.clientId, post_logout_redirect_uri: BACK });
    expect(response.status).toBe(400);
  });

  it('still goes back when clearing the cookie fails', async () => {
    const cookie = await signIn();
    const ticket = await ticketFor(diagram, cookie);
    vi.spyOn(auth.api, 'signOut').mockRejectedValueOnce(new Error('down'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await hop(
      { client_id: diagram.clientId, post_logout_redirect_uri: BACK, ticket },
      cookie,
    );
    expect(response.status).toBe(302);
    expect(logged).toHaveBeenCalledWith('[end-session] sign-out failed', expect.any(Error));
    expect(await sessionOf(cookie)).toBeNull();
  });
});

describe('allowedReturn', () => {
  const registered = [
    'https://livediagram.app/api/auth/callback',
    'http://localhost:3100/api/auth/callback',
    '::',
  ];

  it('takes any path on a registered origin, normalised', () => {
    expect(allowedReturn('https://livediagram.app/', registered)).toBe('https://livediagram.app/');
    expect(allowedReturn('https://livediagram.app', registered)).toBe('https://livediagram.app/');
    expect(allowedReturn('http://localhost:3100/explorer#x', registered)).toBe(
      'http://localhost:3100/explorer#x',
    );
    // The browser reads a backslash as a slash: the address stays on the app.
    expect(allowedReturn('https://livediagram.app\\@evil.example/', registered)).toBe(
      'https://livediagram.app/@evil.example/',
    );
  });

  it('refuses anything else', () => {
    for (const value of [
      '',
      '/relative',
      'not a url',
      'javascript:alert(1)',
      'https://user:pass@livediagram.app/',
      'https://livediagram.app:444/',
      'http://livediagram.app/',
      'http://localhost:3101/',
      `https://livediagram.app/${'a'.repeat(REDIRECT_MAX_LENGTH)}`,
    ]) {
      expect(allowedReturn(value, registered), value).toBeNull();
    }
  });
});

describe("liveworkspace.app's own sign-out", () => {
  it("ends every app's session from it, as Better Auth ends the session", async () => {
    const cookie = await signIn();
    const diagramToken = await signInToApp(diagram, cookie);
    const plannerToken = await signInToApp(planner, cookie);
    const request = new Request(`${BASE}/api/auth/sign-out`, {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: '{}',
    });
    await endSessionTokensOf(request, '/sign-out', auth, env.AUTH_DB);
    // The tokens go first; the session is still Better Auth's to end.
    expect(await sessionOf(cookie)).not.toBeNull();
    expect((await auth.handler(request)).status).toBe(200);
    expect(await sessionOf(cookie)).toBeNull();
    expect(await refreshes(diagram, diagramToken)).toBe(false);
    expect(await refreshes(planner, plannerToken)).toBe(false);
  });

  it('does nothing without a session', async () => {
    await endSessionTokensOf(
      new Request(`${BASE}/api/auth/sign-out`),
      '/sign-out',
      auth,
      env.AUTH_DB,
    );
    expect(count('oauthClient')).toBe(2);
  });
});

describe('Settings › Security signing other devices out', () => {
  const revoke = (cookie: string, route: string, body: unknown = {}) =>
    new Request(`${BASE}/api/auth${route}`, {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function devices() {
    const here = await signIn();
    const there = await signIn();
    return {
      here,
      there,
      hereToken: await signInToApp(diagram, here),
      thereToken: await signInToApp(diagram, there),
      thereSession: (await sessionOf(there))!.session.token,
    };
  }

  it("Sign Out on another device ends that device's apps, and only the caller's own device", async () => {
    const { here, hereToken, thereToken, thereSession } = await devices();
    // Someone else's session token names nothing of the caller's.
    const stranger = await signIn('grace@example.com');
    await endSessionTokensOf(
      revoke(stranger, '/revoke-session', { token: thereSession }),
      '/revoke-session',
      auth,
      env.AUTH_DB,
    );
    expect(await refreshes(diagram, thereToken)).toBe(true);
    await endSessionTokensOf(
      revoke(here, '/revoke-session', {}),
      '/revoke-session',
      auth,
      env.AUTH_DB,
    );
    expect(await refreshes(diagram, thereToken)).toBe(true);

    await endSessionTokensOf(
      revoke(here, '/revoke-session', { token: thereSession }),
      '/revoke-session',
      auth,
      env.AUTH_DB,
    );
    expect(await refreshes(diagram, thereToken)).toBe(false);
    expect(await refreshes(diagram, hereToken)).toBe(true);
  });

  it("Sign Out Others ends every other device's apps; every session ends them all", async () => {
    const { here, hereToken, thereToken } = await devices();
    await endSessionTokensOf(
      revoke(here, '/revoke-other-sessions'),
      '/revoke-other-sessions',
      auth,
      env.AUTH_DB,
    );
    expect(await refreshes(diagram, thereToken)).toBe(false);
    expect(await refreshes(diagram, hereToken)).toBe(true);
    await endSessionTokensOf(
      revoke(here, '/revoke-sessions'),
      '/revoke-sessions',
      auth,
      env.AUTH_DB,
    );
    expect(await refreshes(diagram, hereToken)).toBe(false);
  });

  it('ends many sessions at once in bounded statements', async () => {
    const cookie = await signIn();
    const user = (await sessionOf(cookie))!.user.id;
    const insert = sql.prepare(
      'INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const later = new Date(Date.now() + 86_400_000).toISOString();
    for (let i = 0; i < 95; i++) insert.run(`s${i}`, later, `t${i}`, later, later, user);
    const token = await signInToApp(diagram, cookie);
    await endSessionTokensOf(
      revoke(cookie, '/revoke-sessions'),
      '/revoke-sessions',
      auth,
      env.AUTH_DB,
    );
    expect(await refreshes(diagram, token)).toBe(false);
  });
});
