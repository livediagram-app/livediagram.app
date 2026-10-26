import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authOptions } from './auth-options.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { GUEST_COOKIE, readGuestCookie, signGuestCookie } from './guests.ts';
import { RESOURCES } from './resources.ts';
import { testD1 } from './test-d1.ts';
import { WORKSPACE_TOKEN_TTL_SECONDS, workspaceToken } from './workspace-token.ts';

const BASE = 'https://liveworkspace.app';
const SECRET = 'test-secret-that-is-at-least-32-characters';

let env: Env;
let auth: Auth;
let codes: Map<string, string>;
let limited: boolean;

beforeEach(() => {
  const { db } = testD1();
  codes = new Map();
  limited = false;
  // Turnstile always passes.
  vi.stubGlobal('fetch', async () => Response.json({ success: true }));
  env = {
    ENVIRONMENT: 'production',
    BASE_URL: BASE,
    BETTER_AUTH_SECRET: SECRET,
    AUTH_DB: db,
    GUEST_LIMITER: { limit: async () => ({ success: !limited }) },
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
      db,
    ),
  ) as unknown as Auth;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const decode = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;

function ask(headers: Record<string, string> = {}) {
  return workspaceToken(new Request(`${BASE}/api/auth/workspace-token`, { headers }), env, auth);
}

async function sessionCookie(): Promise<string> {
  const email = 'ada@example.com';
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
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

describe("liveworkspace.app's own token", () => {
  it("gives a signed-in person a short access token for every app's API, with their teams", async () => {
    const cookie = await sessionCookie();
    const response = await ask({ cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as { token: string; kind: string; sub: string };
    expect(body.kind).toBe('account');
    expect(body.sub).toMatch(/^user_/);
    const claims = decode(body.token);
    expect(claims).toMatchObject({
      iss: `${BASE}/api/auth`,
      aud: RESOURCES.production,
      sub: body.sub,
      email: 'ada@example.com',
      teams: [],
    });
    expect(claims.kind).toBeUndefined();
    expect((claims.exp as number) - (claims.iat as number)).toBe(WORKSPACE_TOKEN_TTL_SECONDS);
  });

  it('gives anyone else a guest token, keeping the browser’s guest and setting its cookie', async () => {
    const guestId = 'guest_00000000-0000-4000-8000-000000000001';
    const response = await ask({
      cookie: `${GUEST_COOKIE}=${await signGuestCookie(guestId, SECRET)}`,
    });
    const body = (await response.json()) as { token: string; kind: string; sub: string };
    expect(body).toMatchObject({ kind: 'guest', sub: guestId });
    expect(decode(body.token)).toMatchObject({
      sub: guestId,
      kind: 'guest',
      aud: RESOURCES.production,
    });
    const set = response.headers.getSetCookie()[0]!;
    expect(set).toMatch(/HttpOnly/);
    expect(await readGuestCookie(set.split(';')[0]!.slice(GUEST_COOKIE.length + 1), SECRET)).toBe(
      guestId,
    );
  });

  it('makes a new guest for a first visit, limited per network', async () => {
    const body = (await (await ask()).json()) as { kind: string; sub: string };
    expect(body.kind).toBe('guest');
    expect(body.sub).toMatch(/^guest_[0-9a-f-]{36}$/);
    limited = true;
    expect((await ask()).status).toBe(429);
  });

  it('refuses a request from another site', async () => {
    expect((await ask({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });
});
