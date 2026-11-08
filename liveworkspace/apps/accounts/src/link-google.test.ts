// Connecting Google from an app's Settings (liveworkspace/docs/specs/003-accounts/accounts.md "Every account setting
// in every app"): a real Better Auth over an in-memory D1, signed in with a real code, the bearer's start, the hop on
// this Worker's address, and Google's answer (its token endpoint stubbed) through Better Auth's own callback.
import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { allAppOrigins, type Auth } from './auth.ts';
import { authOptions } from './auth-options.ts';
import type { Env } from './env.ts';
import {
  LINK_TICKET_TTL_SECONDS,
  linkCallback,
  linkGoogleHop,
  readLinkTicket,
  signLinkTicket,
  startGoogleLink,
} from './link-google.ts';
import { RESOURCES } from './resources.ts';
import { testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const BACK = 'https://liveplanner.app/p/1?settings=profile';

let env: Env;
let auth: Auth;
let sql: DatabaseSync;
let codes: Map<string, string>;
// What Google's token endpoint answers: an ID token for this address, verified or not.
let google: { email: string; verified: boolean; nonce?: string };

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

beforeEach(() => {
  const made = testD1();
  sql = made.sql;
  codes = new Map();
  google = { email: 'ada@example.com', verified: true };
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const idToken = `${b64({ alg: 'RS256' })}.${b64({
        iss: 'https://accounts.google.com',
        sub: 'google-ada',
        email: google.email,
        email_verified: google.verified,
        name: 'Ada',
        nonce: google.nonce,
        exp: Math.floor(Date.now() / 1000) + 600,
      })}.sig`;
      return Response.json({
        access_token: 'g-access',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      });
    }
    // Turnstile always passes.
    return Response.json({ success: true });
  });
  env = {
    ENVIRONMENT: 'production',
    BASE_URL: BASE,
    BETTER_AUTH_SECRET: SECRET,
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
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
        google: { clientId: 'google-id', clientSecret: 'google-secret' },
        appOrigins: allAppOrigins('production'),
        sendCode: async (email, code) => void codes.set(email, code),
      },
      made.db,
    ),
  ) as unknown as Auth;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Signs in with an emailed code, as a browser on liveworkspace.app would: the account and its session.
async function signIn(email = 'ada@example.com'): Promise<{ userId: string; sessionId: string }> {
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
  const row = sql
    .prepare(
      'SELECT s.id AS sessionId, s.userId FROM session s JOIN "user" u ON u.id = s.userId WHERE u.email = ?',
    )
    .get(email) as { sessionId: string; userId: string };
  return row;
}

const start = (userId: string, sessionId: string | null, callbackURL: unknown = BACK) =>
  startGoogleLink(
    new Request(`${BASE}/api/account/sign-in-methods/google`, {
      method: 'POST',
      body: JSON.stringify({ callbackURL }),
    }),
    env,
    userId,
    sessionId,
  );

async function hopUrl(userId: string, sessionId: string): Promise<string> {
  const res = await start(userId, sessionId);
  expect(res.status).toBe(200);
  return ((await res.json()) as { url: string }).url;
}

describe('connecting Google from an app’s Settings', () => {
  it('goes on to Google with the state cookie alone, then links Google and comes back', async () => {
    const { userId, sessionId } = await signIn();
    const hop = await linkGoogleHop(new Request(await hopUrl(userId, sessionId)), env, auth);
    expect(hop.status).toBe(302);
    const to = new URL(hop.headers.get('location')!);
    expect(to.origin).toBe('https://accounts.google.com');
    expect(to.searchParams.get('redirect_uri')).toBe(`${BASE}/api/auth/callback/google`);
    expect(hop.headers.get('cache-control')).toBe('no-store');
    // Only the flow's state: never the session's cookie, which would sign in whoever opened the hop.
    const cookies = hop.headers.getSetCookie();
    expect(cookies.map((c) => c.split('=')[0])).toEqual(['__Secure-better-auth.state']);
    expect(cookies.join(';')).not.toContain('session_token');

    google.nonce = to.searchParams.get('nonce') ?? undefined;
    const callback = await auth.handler(
      new Request(
        `${BASE}/api/auth/callback/google?state=${to.searchParams.get('state')}&code=g-code`,
        { headers: { cookie: cookies[0]!.split(';')[0]! } },
      ),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe(BACK);
    expect(sql.prepare("SELECT userId FROM account WHERE providerId = 'google'").all()).toEqual([
      { userId },
    ]);
    // Already connected, a second start is refused.
    expect(await (await start(userId, sessionId)).json()).toEqual({ error: 'already_connected' });
  });

  it('links no Google account of another address, sending the browser back with the reason', async () => {
    const { userId, sessionId } = await signIn();
    const hop = await linkGoogleHop(new Request(await hopUrl(userId, sessionId)), env, auth);
    const to = new URL(hop.headers.get('location')!);
    google = {
      email: 'mallory@example.com',
      verified: true,
      nonce: to.searchParams.get('nonce') ?? undefined,
    };
    const callback = await auth.handler(
      new Request(
        `${BASE}/api/auth/callback/google?state=${to.searchParams.get('state')}&code=g-code`,
        { headers: { cookie: hop.headers.getSetCookie()[0]!.split(';')[0]! } },
      ),
    );
    const location = new URL(callback.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe('https://liveplanner.app/p/1');
    expect(location.searchParams.get('error')).toBeTruthy();
    expect(sql.prepare("SELECT 1 FROM account WHERE providerId = 'google'").all()).toEqual([]);
  });

  it('goes back with session_ended when the session went before the hop', async () => {
    const { userId, sessionId } = await signIn();
    const url = await hopUrl(userId, sessionId);
    sql.prepare('DELETE FROM session WHERE id = ?').run(sessionId);
    const hop = await linkGoogleHop(new Request(url), env, auth);
    expect(hop.status).toBe(302);
    expect(hop.headers.get('location')).toBe(`${BACK}&error=session_ended`);
    expect(hop.headers.getSetCookie()).toEqual([]);
  });

  it('refuses a forged, altered, expired or missing ticket, going nowhere', async () => {
    const { userId, sessionId } = await signIn();
    const url = new URL(await hopUrl(userId, sessionId));
    const ticket = url.searchParams.get('ticket')!;
    const now = Math.floor(Date.now() / 1000);
    const forged = await signLinkTicket(
      { u: userId, s: sessionId, c: BACK, e: now + 60 },
      'another-secret-that-is-at-least-32-chars',
    );
    const expired = await signLinkTicket({ u: userId, s: sessionId, c: BACK, e: now - 1 }, SECRET);
    const elsewhere = await signLinkTicket(
      { u: userId, s: sessionId, c: 'https://evil.example/', e: now + 60 },
      SECRET,
    );
    for (const bad of [null, '', 'x', forged, expired, elsewhere, `${ticket.slice(0, -2)}AA`]) {
      const hop = new URL(`${BASE}/api/auth/link-google`);
      if (bad !== null) hop.searchParams.set('ticket', bad);
      const res = await linkGoogleHop(new Request(hop), env, auth);
      expect(res.status).toBe(400);
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('refuses another account’s session on the ticket', async () => {
    const ada = await signIn();
    const bea = await signIn('bea@example.com');
    const ticket = await signLinkTicket(
      { u: ada.userId, s: bea.sessionId, c: BACK, e: Math.floor(Date.now() / 1000) + 60 },
      SECRET,
    );
    const hop = await linkGoogleHop(
      new Request(`${BASE}/api/auth/link-google?ticket=${encodeURIComponent(ticket)}`),
      env,
      auth,
    );
    expect(hop.headers.get('location')).toBe(`${BACK}&error=session_ended`);
    expect(await (await start(ada.userId, bea.sessionId)).json()).toEqual({
      error: 'session_ended',
    });
  });

  it('sends Better Auth’s refusal back when the link cannot start', async () => {
    const { userId, sessionId } = await signIn();
    const url = await hopUrl(userId, sessionId);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      $context: auth.$context,
      api: {
        linkSocialAccount: async () => {
          throw new Error('down');
        },
      },
    } as unknown as Auth;
    const failed = await linkGoogleHop(new Request(url), env, broken);
    expect(failed.headers.get('location')).toBe(`${BACK}&error=link_failed`);
    const empty = {
      $context: auth.$context,
      api: {
        linkSocialAccount: async () => ({ headers: new Headers(), response: { redirect: false } }),
      },
    } as unknown as Auth;
    expect((await linkGoogleHop(new Request(url), env, empty)).headers.get('location')).toBe(
      `${BACK}&error=link_failed`,
    );
  });
});

describe('the ticket and the return address', () => {
  it('reads a ticket it signed until it lapses', async () => {
    const at = Date.UTC(2026, 10, 8);
    const ticket = await signLinkTicket(
      { u: 'user_a', s: 's1', c: BACK, e: at / 1000 + LINK_TICKET_TTL_SECONDS },
      SECRET,
    );
    expect(await readLinkTicket(ticket, SECRET, at)).toEqual({
      u: 'user_a',
      s: 's1',
      c: BACK,
      e: at / 1000 + LINK_TICKET_TTL_SECONDS,
    });
    expect(await readLinkTicket(ticket, SECRET, at + LINK_TICKET_TTL_SECONDS * 1000)).toBeNull();
    // Signed, but not a ticket's shape.
    const { makeSignature } = await import('better-auth/crypto');
    const odd = b64({ u: 1 });
    expect(
      await readLinkTicket(`${odd}.${await makeSignature(`link-google:${odd}`, SECRET)}`, SECRET),
    ).toBeNull();
    const notJson = Buffer.from('nope').toString('base64url');
    expect(
      await readLinkTicket(
        `${notJson}.${await makeSignature(`link-google:${notJson}`, SECRET)}`,
        SECRET,
      ),
    ).toBeNull();
  });

  it('allows the apps’ own origins and this Worker’s, and nothing else', () => {
    expect(linkCallback('https://livediagram.app/d/1', env)).toBe('https://livediagram.app/d/1');
    expect(linkCallback('https://www.liveplanner.app/', env)).toBe('https://www.liveplanner.app/');
    expect(linkCallback('https://liveworkspace.app/explorer', env)).toBe(
      'https://liveworkspace.app/explorer',
    );
    expect(linkCallback('https://www.liveworkspace.app/', env)).toBe(
      'https://www.liveworkspace.app/',
    );
    for (const bad of [
      'https://evil.example/',
      'http://livediagram.app/',
      'https://staging.livediagram.app/',
      'ftp://livediagram.app/',
      'https://a:b@livediagram.app/',
      'not a url',
      '',
      null,
    ]) {
      expect(linkCallback(bad, env)).toBeNull();
    }
  });

  it('refuses a start when Google is off', async () => {
    env.GOOGLE_CLIENT_ID = '';
    expect(await (await start('user_a', 's1')).json()).toEqual({ error: 'google_off' });
  });

  it('refuses a body that names no return address', async () => {
    const { userId, sessionId } = await signIn();
    const res = await startGoogleLink(
      new Request(`${BASE}/x`, { method: 'POST', body: 'not json' }),
      env,
      userId,
      sessionId,
    );
    expect(await res.json()).toEqual({ error: 'invalid_callback' });
  });
});
