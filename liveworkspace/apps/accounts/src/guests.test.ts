import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authOptions } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import {
  GUEST_COOKIE,
  GUEST_TOKEN_TTL_SECONDS,
  guestHandoff,
  guestMergeConfig,
  mergeGuestOnAuthorize,
  readGuestCookie,
  signGuestCookie,
} from './guests.ts';
import { startLifecycle } from './lifecycle.ts';
import { readProfiles, writeProfile } from './profiles.ts';
import { readSettings, writeSettings } from './settings.ts';
import { testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const CLIENT_ID = 'liveplanner-client';
const RESOURCE = 'https://liveplanner.app/api';
const GUEST_RETURN = 'https://liveplanner.app/auth/guest';
const INDEX_URL = `${BASE}/api/index`;

let env: Env;
let auth: Auth;
let codes: Map<string, string>;
let merges: { url: string; authorization: string | null; body: unknown }[];
let mergeStatus: number;
let created: string[];

// A real Better Auth over an in-memory D1, with one client registered for liveplanner. fetch is
// stubbed for Turnstile (always passes) and the index (records each merge).
beforeEach(() => {
  const { db, sql } = testD1();
  const now = new Date().toISOString();
  sql
    .prepare(
      `INSERT INTO oauthClient (id, clientId, redirectUris, disabled, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)`,
    )
    .run(
      'c1',
      CLIENT_ID,
      JSON.stringify(['https://liveplanner.app/auth/callback', GUEST_RETURN]),
      now,
      now,
    );
  sql
    .prepare(
      `INSERT INTO oauthResource (id, identifier, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('r1', RESOURCE, RESOURCE, now, now);
  sql
    .prepare(
      `INSERT INTO oauthClientResource (id, clientId, resourceId, createdAt) VALUES (?, ?, ?, ?)`,
    )
    .run('cr1', CLIENT_ID, RESOURCE, now);

  codes = new Map();
  merges = [];
  created = [];
  mergeStatus = 204;
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(INDEX_URL)) {
      merges.push({
        url,
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(null, { status: mergeStatus });
    }
    return Response.json({ success: true });
  });

  env = {
    ENVIRONMENT: 'production',
    BASE_URL: BASE,
    BETTER_AUTH_SECRET: SECRET,
    AUTH_DB: db,
  } as unknown as Env;
  auth = buildAuth({ secure: true, indexUrl: INDEX_URL, indexMergeKey: 'merge-key' });
});

function buildAuth(guestMerge: { secure: boolean; indexUrl?: string; indexMergeKey?: string }) {
  return betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: SECRET,
        resources: [RESOURCE],
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async (email, code) => void codes.set(email, code),
        guestMerge: { ...guestMerge, db: env.AUTH_DB },
        onUserCreated: async (user) => {
          created.push(user.id);
          await startLifecycle(env.AUTH_DB, user);
        },
      },
      env.AUTH_DB,
    ),
  ) as unknown as Auth;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function handoff(
  query: Record<string, string> = { client_id: CLIENT_ID, redirect_uri: GUEST_RETURN, state: 's1' },
  cookie?: string,
) {
  return guestHandoff(
    new Request(`${BASE}/api/auth/guest?${new URLSearchParams(query)}`, {
      headers: cookie ? { cookie: `${GUEST_COOKIE}=${cookie}` } : {},
    }),
    env,
    auth,
  );
}

function setGuestCookie(response: Response): string | undefined {
  return response.headers.getSetCookie().find((c) => c.startsWith(`${GUEST_COOKIE}=`));
}

const cookieValueOf = (setCookie: string | undefined) =>
  setCookie?.split(';')[0]!.slice(GUEST_COOKIE.length + 1) ?? '';

function fragmentOf(response: Response) {
  const location = response.headers.get('location') ?? '';
  const [uri, fragment] = location.split('#');
  return { uri, params: new URLSearchParams(fragment) };
}

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

// Checks a JWT's signature against the keys the jwt plugin serves at /api/auth/jwks.
async function verified(token: string): Promise<Record<string, unknown>> {
  const [header, payload, signature] = token.split('.') as [string, string, string];
  const { kid, alg } = decode(header);
  const jwks = (await (await auth.handler(new Request(`${BASE}/api/auth/jwks`))).json()) as {
    keys: (JsonWebKey & { kid: string })[];
  };
  const jwk = jwks.keys.find((key) => key.kid === kid);
  expect(jwk).toBeDefined();
  expect(alg).toBe('EdDSA');
  const key = await crypto.subtle.importKey('jwk', jwk!, { name: 'Ed25519' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'Ed25519',
    key,
    Buffer.from(signature, 'base64url'),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  expect(valid).toBe(true);
  return decode(payload);
}

describe('the guest hand-off', () => {
  it('sets the cookie and redirects with a token signed by the published keys', async () => {
    const response = await handoff();
    expect(response.status).toBe(302);

    const setCookie = setGuestCookie(response);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Path=\//);
    const guestId = await readGuestCookie(cookieValueOf(setCookie), SECRET);
    expect(guestId).toMatch(/^guest_[0-9a-f-]{36}$/);

    const { uri, params } = fragmentOf(response);
    expect(uri).toBe(GUEST_RETURN);
    expect(params.get('state')).toBe('s1');
    const claims = await verified(params.get('guest_token')!);
    expect(claims).toMatchObject({
      iss: `${BASE}/api/auth`,
      aud: RESOURCE,
      sub: guestId,
      kind: 'guest',
    });
    expect((claims.exp as number) - (claims.iat as number)).toBe(GUEST_TOKEN_TTL_SECONDS);
  });

  it('notes when the guest id was handed out', async () => {
    const guestId = await readGuestCookie(cookieValueOf(setGuestCookie(await handoff())), SECRET);
    const row = await env.AUTH_DB.prepare('SELECT seen_at FROM guest_seen WHERE guest_id = ?')
      .bind(guestId)
      .first<{ seen_at: number }>();
    expect(row?.seen_at).toBeGreaterThan(Date.now() - 60_000);
  });

  it('keeps the same guest for a browser that already has the cookie', async () => {
    const first = cookieValueOf(setGuestCookie(await handoff()));
    const again = await handoff(undefined, first);
    expect(await readGuestCookie(cookieValueOf(setGuestCookie(again)), SECRET)).toBe(
      await readGuestCookie(first, SECRET),
    );
    const claims = await verified(fragmentOf(again).params.get('guest_token')!);
    expect(claims.sub).toBe(await readGuestCookie(first, SECRET));
  });

  it('makes a new guest when the cookie has been tampered with', async () => {
    const value = await signGuestCookie(`guest_${crypto.randomUUID()}`, SECRET);
    const forged = `guest_${crypto.randomUUID()}${value.slice(value.indexOf('.'))}`;
    expect(await readGuestCookie(forged, SECRET)).toBeNull();
    expect(
      await readGuestCookie(await signGuestCookie('guest_x', 'another-secret'), SECRET),
    ).toBeNull();

    const response = await handoff(undefined, forged);
    const claims = await verified(fragmentOf(response).params.get('guest_token')!);
    expect(claims.sub).not.toBe(forged.split('.')[0]);
    expect(claims.sub).toBe(await readGuestCookie(cookieValueOf(setGuestCookie(response)), SECRET));
  });

  it('refuses an unregistered redirect without redirecting', async () => {
    for (const redirect of [
      'https://evil.example/auth/guest',
      `${GUEST_RETURN}/`,
      `${GUEST_RETURN}?x=1`,
    ]) {
      const response = await handoff({ client_id: CLIENT_ID, redirect_uri: redirect, state: 's' });
      expect(response.status).toBe(400);
      expect(response.headers.get('location')).toBeNull();
      expect(setGuestCookie(response)).toBeUndefined();
      expect(await response.json()).toEqual({ error: 'invalid_redirect_uri' });
    }
  });

  it('refuses an unknown client', async () => {
    const response = await handoff({ client_id: 'nobody', redirect_uri: GUEST_RETURN, state: 's' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_client' });
  });

  it('needs a state of at most 200 characters', async () => {
    for (const state of [undefined, '', 'x'.repeat(201)]) {
      const query: Record<string, string> = { client_id: CLIENT_ID, redirect_uri: GUEST_RETURN };
      if (state !== undefined) query.state = state;
      const response = await handoff(query);
      expect(response.status).toBe(400);
      expect(response.headers.get('location')).toBeNull();
      expect(await response.json()).toEqual({ error: 'invalid_state' });
    }
  });

  it('takes only a resource the client is registered for', async () => {
    const response = await handoff({
      client_id: CLIENT_ID,
      redirect_uri: GUEST_RETURN,
      state: 's',
      resource: 'https://livediagram.app/api',
    });
    expect(await response.json()).toEqual({ error: 'invalid_resource' });
  });
});

describe('signing in as a guest', () => {
  async function signIn(cookie?: string) {
    const email = 'ada@example.com';
    const json = { 'content-type': 'application/json', origin: BASE };
    const sent = await auth.handler(
      new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { ...json, 'x-captcha-response': 'ok' },
        body: JSON.stringify({ email, type: 'sign-in' }),
      }),
    );
    expect(sent.status).toBe(200);
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { ...json, ...(cookie && { cookie: `${GUEST_COOKIE}=${cookie}` }) },
        body: JSON.stringify({ email, otp: codes.get(email) }),
      }),
    );
    expect(response.status).toBe(200);
    return response;
  }

  it('tells the index once, then clears the cookie beside the session', async () => {
    const cookie = cookieValueOf(setGuestCookie(await handoff()));
    const response = await signIn(cookie);
    const { user } = (await response.json()) as { user: { id: string } };

    expect(merges).toEqual([
      {
        url: `${INDEX_URL}/internal/merge`,
        authorization: 'Bearer merge-key',
        body: { guestId: await readGuestCookie(cookie, SECRET), userId: user.id },
      },
    ]);
    const cleared = setGuestCookie(response);
    expect(cleared).toMatch(new RegExp(`^${GUEST_COOKIE}=;`));
    expect(cleared).toMatch(/Max-Age=0/);
    expect(response.headers.getSetCookie().some((c) => c.includes('session_token='))).toBe(true);
  });

  it("moves the guest's settings to the account, even with no index to tell", async () => {
    const cookie = cookieValueOf(setGuestCookie(await handoff()));
    const guestId = (await readGuestCookie(cookie, SECRET))!;
    await writeSettings(env.AUTH_DB, guestId, 'liveplanner.app', {
      all: { theme: 'dark' },
      app: { density: 'compact' },
    });
    auth = buildAuth({ secure: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { user } = (await (await signIn(cookie)).json()) as { user: { id: string } };
    expect(await readSettings(env.AUTH_DB, user.id, 'liveplanner.app')).toMatchObject({
      all: { theme: 'dark' },
      app: { density: 'compact' },
    });
    expect(await readSettings(env.AUTH_DB, guestId, 'liveplanner.app')).toMatchObject({
      updatedAt: null,
    });
  });

  it("moves the guest's colour to the account and forgets the guest", async () => {
    const cookie = cookieValueOf(setGuestCookie(await handoff()));
    const guestId = (await readGuestCookie(cookie, SECRET))!;
    await writeProfile(env.AUTH_DB, guestId, { name: 'Guesty', color: '#22c55e' });
    const { user } = (await (await signIn(cookie)).json()) as { user: { id: string } };
    expect((await readProfiles(env.AUTH_DB, [user.id]))[0]).toMatchObject({ color: '#22c55e' });
    expect(await readProfiles(env.AUTH_DB, [guestId])).toEqual([]);
    const seen = await env.AUTH_DB.prepare('SELECT count(*) AS n FROM guest_seen').first<number>(
      'n',
    );
    expect(seen).toBe(0);
  });

  it('starts the onboarding series when an account is made, and not on a later sign-in', async () => {
    const { user } = (await (await signIn()).json()) as { user: { id: string } };
    await signIn();
    expect(created).toEqual([user.id]);
    const row = await env.AUTH_DB.prepare('SELECT user_id FROM email_lifecycle').first<string>(
      'user_id',
    );
    expect(row).toBe(user.id);
  });

  it('leaves the index alone without a guest cookie, or with a forged one', async () => {
    await signIn();
    await signIn(`guest_${crypto.randomUUID()}.AAAA`);
    expect(merges).toEqual([]);
  });

  it('keeps the guest when there is no index to tell', async () => {
    const cookie = cookieValueOf(setGuestCookie(await handoff()));
    auth = buildAuth({ secure: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await signIn(cookie);
    expect(merges).toEqual([]);
    expect(setGuestCookie(response)).toBeUndefined();
  });

  it('keeps the cookie when the merge fails, so the next sign-in tries again', async () => {
    const cookie = cookieValueOf(setGuestCookie(await handoff()));
    mergeStatus = 503;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await signIn(cookie);
    expect(merges).toHaveLength(1);
    expect(setGuestCookie(response)).toBeUndefined();
  });
});

describe('signing in to an app with a session already there', () => {
  // A session made with no guest cookie, so the session hook has nothing to merge.
  async function session(): Promise<{ cookie: string; userId: string }> {
    const email = 'grace@example.com';
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
    const { user } = (await response.json()) as { user: { id: string } };
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return { cookie, userId: user.id };
  }

  const config = () => ({
    ...guestMergeConfig(env),
    indexUrl: INDEX_URL,
    indexMergeKey: 'merge-key',
  });
  const userIdOf = async (headers: Headers) =>
    (await auth.api.getSession({ headers }))?.user.id ?? null;
  const answer = (location: string) => new Response(null, { status: 302, headers: { location } });

  function authorizeRequest(cookie: string) {
    return new Request(`${BASE}/api/auth/oauth2/authorize?prompt=none`, { headers: { cookie } });
  }

  it("hands the guest's things to the account when the answer carries a code", async () => {
    const { cookie, userId } = await session();
    const guest = cookieValueOf(setGuestCookie(await handoff()));
    const guestId = (await readGuestCookie(guest, SECRET))!;
    merges = [];
    const response = await mergeGuestOnAuthorize(
      authorizeRequest(`${cookie}; ${GUEST_COOKIE}=${guest}`),
      answer('https://liveplanner.app/auth/callback?code=abc&state=s'),
      config(),
      userIdOf,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('code=abc');
    expect(merges).toEqual([expect.objectContaining({ body: { guestId, userId } })]);
    expect(setGuestCookie(response)).toMatch(/Max-Age=0/);
  });

  it('leaves everything alone for an error answer, no guest cookie, or no session', async () => {
    const { cookie } = await session();
    const guest = cookieValueOf(setGuestCookie(await handoff()));
    merges = [];
    const failed = await mergeGuestOnAuthorize(
      authorizeRequest(`${cookie}; ${GUEST_COOKIE}=${guest}`),
      answer('https://liveplanner.app/auth/callback?error=login_required&state=s'),
      config(),
      userIdOf,
    );
    expect(setGuestCookie(failed)).toBeUndefined();
    await mergeGuestOnAuthorize(
      authorizeRequest(cookie),
      answer('https://liveplanner.app/auth/callback?code=abc'),
      config(),
      userIdOf,
    );
    await mergeGuestOnAuthorize(
      authorizeRequest(`${GUEST_COOKIE}=${guest}`),
      answer('https://liveplanner.app/auth/callback?code=abc'),
      config(),
      userIdOf,
    );
    expect(merges).toEqual([]);
  });

  it('keeps the guest cookie when the index merge fails', async () => {
    const { cookie } = await session();
    const guest = cookieValueOf(setGuestCookie(await handoff()));
    mergeStatus = 503;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await mergeGuestOnAuthorize(
      authorizeRequest(`${cookie}; ${GUEST_COOKIE}=${guest}`),
      answer('https://liveplanner.app/auth/callback?code=abc'),
      config(),
      userIdOf,
    );
    expect(setGuestCookie(response)).toBeUndefined();
  });
});

describe('prompt=none', () => {
  it('answers login_required straight away when there is no session, never a page', async () => {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: 'https://liveplanner.app/auth/callback',
      scope: 'openid email profile offline_access',
      state: 'st',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      resource: RESOURCE,
      prompt: 'none',
    });
    const response = await auth.handler(new Request(`${BASE}/api/auth/oauth2/authorize?${query}`));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe('https://liveplanner.app/auth/callback');
    expect(location.searchParams.get('error')).toBe('login_required');
    expect(location.searchParams.get('state')).toBe('st');
  });
});
