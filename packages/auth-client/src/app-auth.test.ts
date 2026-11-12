import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configured,
  createAppAuth,
  decodeLatin1PkceCookie,
  decodeUtf8PkceCookie,
  encodeLatin1PkceCookie,
  encodeUtf8PkceCookie,
  readCookie,
  type AppAuthEnv,
} from './app-auth';

// The shared /api/auth routes (each product's docs/specs/014-identity/auth-and-guest-access.md "Signing in"). Each
// product's apps/api routes/auth.test.ts drives its own binding end to end; these pin the options its copies had
// drifted on, and the cookie codecs.

const ENV: AppAuthEnv = {
  ACCOUNTS_URL: 'https://accounts.example',
  ACCOUNTS_CLIENT_ID: 'client',
  ACCOUNTS_CLIENT_SECRET: 'shh',
  API_RESOURCE: 'https://app.example/api',
};
const APP = 'https://app.example';

const b64url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: 'none' })}.${b64url(payload)}.`;

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tokenResponse = (idToken: string) =>
  new Response(
    JSON.stringify({ access_token: 'a', refresh_token: 'r2', id_token: idToken, expires_in: 60 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
function routes(over: Partial<Parameters<typeof createAppAuth>[0]> = {}) {
  return createAppAuth<AppAuthEnv>({
    hintCookie: 'x_signed_in',
    pkceCookie: 'x_pkce',
    refreshCookie: 'x_refresh',
    safeReturnPath: (v) => (v?.startsWith('/') ? v : '/explorer/home'),
    encodePkce: encodeUtf8PkceCookie,
    decodePkce: decodeUtf8PkceCookie,
    json,
    notFound: () => new Response('nf', { status: 404 }),
    rateLimited: () => new Response('rl', { status: 429 }),
    clientRateKey: () => 'ip',
    reportSignIn: async () => null,
    ...over,
  });
}
const call = (
  auth: ReturnType<typeof routes>,
  path: string,
  init: RequestInit = {},
  env: AppAuthEnv = ENV,
) => {
  const request = new Request(`${APP}${path}`, init);
  return auth.handleAuth(request, env, new URL(request.url).pathname.slice(1).split('/'), () => {});
};

describe('the PKCE cookie codecs', () => {
  const value = { state: 's', verifier: 'v', returnTo: '/a' };
  it('round-trips, and reads a malformed or partial cookie as none', () => {
    expect(decodeLatin1PkceCookie(encodeLatin1PkceCookie(value))).toEqual(value);
    expect(
      decodeUtf8PkceCookie(encodeUtf8PkceCookie({ ...value, returnTo: '/☕' }))?.returnTo,
    ).toBe('/☕');
    for (const decode of [decodeLatin1PkceCookie, decodeUtf8PkceCookie]) {
      expect(decode(null)).toBeNull();
      expect(decode('%%%')).toBeNull();
      expect(decode(b64url({ state: 's' }))).toBeNull();
    }
  });
});

describe('readCookie and configured', () => {
  it('reads one cookie by name', () => {
    const request = new Request(APP, { headers: { Cookie: 'a=1; b= ; c=3' } });
    expect(readCookie(request, 'c')).toBe('3');
    expect(readCookie(request, 'b')).toBeNull();
    expect(readCookie(new Request(APP), 'a')).toBeNull();
  });

  it('is null on a guest-only deployment', () => {
    expect(configured({})).toBeNull();
    expect(configured(ENV)?.clientId).toBe('client');
  });
});

describe('the options a product binds', () => {
  it('adds familyName to the user only when asked', async () => {
    const id = jwt({ sub: 'u', given_name: 'Ada', family_name: ' Lovelace ' });
    fetchMock.mockResolvedValueOnce(tokenResponse(id));
    const withFamily = routes({ familyName: true });
    const res = await call(withFamily, '/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'x_refresh=r1' },
    });
    const body = (await res.json()) as { user: Record<string, unknown> };
    expect(Object.keys(body.user)).toEqual([
      'id',
      'email',
      'givenName',
      'familyName',
      'name',
      'color',
      'picture',
      'pictureHidden',
    ]);
    expect(body.user.familyName).toBe('Lovelace');
    fetchMock.mockResolvedValueOnce(tokenResponse(id));
    const plain = await call(routes(), '/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'x_refresh=r1' },
    });
    expect((await plain.json()).user).not.toHaveProperty('familyName');
  });

  it('says the token age only when asked, and only with an issue time', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const aged = routes({ tokenAge: true });
    const post = { method: 'POST', headers: { Cookie: 'x_refresh=r1' } };
    fetchMock.mockResolvedValueOnce(tokenResponse(jwt({ sub: 'u', iat: now / 1000 - 5 })));
    expect((await (await call(aged, '/api/auth/token', post)).json()).tokenAgeMs).toBe(5000);
    fetchMock.mockResolvedValueOnce(tokenResponse(jwt({ sub: 'u' })));
    expect(await (await call(aged, '/api/auth/token', post)).json()).not.toHaveProperty(
      'tokenAgeMs',
    );
    fetchMock.mockResolvedValueOnce(tokenResponse('not-a-jwt'));
    const unread = await (await call(aged, '/api/auth/token', post)).json();
    expect(unread.user).toBeNull();
    expect(unread).not.toHaveProperty('tokenAgeMs');
  });

  it('percent-encodes a Location past ASCII only when asked', async () => {
    const limited = { ...ENV, WRITE_RATE_LIMITER: { limit: async () => ({ success: false }) } };
    const back = () => '/☕';
    const ascii = routes({ asciiLocation: true, safeReturnPath: back });
    const res = await call(ascii, '/api/auth/silent', {}, limited);
    expect(res.headers.get('Location')).toBe('/%E2%98%95');
    await expect(
      call(routes({ safeReturnPath: back }), '/api/auth/silent', {}, limited),
    ).rejects.toThrow();
  });
});

describe('the route table', () => {
  it('answers not found, not configured and rate limited', async () => {
    const auth = routes();
    expect((await call(auth, '/api/auth')).status).toBe(404);
    expect((await call(auth, '/api/auth/nope')).status).toBe(404);
    expect((await call(auth, '/api/auth/token', { method: 'POST' }, {})).status).toBe(404);
    const limited = { ...ENV, WRITE_RATE_LIMITER: { limit: async () => ({ success: false }) } };
    expect((await call(auth, '/api/auth/sign-in', {}, limited)).status).toBe(429);
    const silent = await call(auth, '/api/auth/silent?return=/x', {}, limited);
    expect(silent.headers.get('Location')).toBe('/x');
  });
});
