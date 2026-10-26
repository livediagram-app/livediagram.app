import { sentForm, sentUrl } from '@liveworkspace/vitest-config/sent-request';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const reportSignIn = vi.fn(async (_env: Env, _userId: string) => null);
vi.mock('../auth/session-telemetry', () => ({
  reportSignIn: (env: Env, userId: string) => reportSignIn(env, userId),
}));

import { handleAuth, readCookie, safeReturnPath } from './auth';

// The sign-in round trip through the accounts Worker (docs/specs/014-identity/auth-and-guest-access.md
// "Signing in"). The accounts Worker's token endpoint is stubbed; what is pinned here is what this
// worker sends it, what it keeps in cookies, and where the browser is sent.

const ENV = {
  ACCOUNTS_URL: 'https://accounts.example',
  ACCOUNTS_CLIENT_ID: 'client-lp',
  ACCOUNTS_CLIENT_SECRET: 'shh',
  API_RESOURCE: 'https://lp.example/api',
} as unknown as Env;

const APP = 'https://lp.example';

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: 'none' })}.${b64url(payload)}.`;

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  reportSignIn.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function tokenResponse(over: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      access_token: 'access-1',
      refresh_token: 'refresh-2',
      id_token: jwt({ sub: 'user_abc', email: 'ada@example.com', name: 'Ada Lovelace' }),
      expires_in: 3600,
      ...over,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const waitUntil = vi.fn();
function call(path: string, init: RequestInit & { env?: Env } = {}) {
  const request = new Request(`${APP}${path}`, init);
  const segments = new URL(request.url).pathname.slice(1).split('/');
  return handleAuth(request, init.env ?? ENV, segments, waitUntil);
}

const setCookies = (res: Response) => res.headers.getSetCookie();
const cookieValue = (res: Response, name: string) =>
  setCookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0]!
    .slice(name.length + 1);

async function signInCookie(returnTo = '/document/abc') {
  const res = await call(`/api/auth/sign-in?return_to=${encodeURIComponent(returnTo)}`);
  const location = new URL(res.headers.get('Location')!);
  return { res, location, pkce: cookieValue(res, 'ld_pkce')! };
}

describe('GET /api/auth/sign-in', () => {
  it('sends the browser to the accounts site with PKCE, state and this API as the resource', async () => {
    const { res, location } = await signInCookie();
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe(
      'https://accounts.example/api/auth/oauth2/authorize',
    );
    expect(location.searchParams.get('client_id')).toBe('client-lp');
    expect(location.searchParams.get('redirect_uri')).toBe(`${APP}/api/auth/callback`);
    expect(location.searchParams.get('resource')).toBe('https://lp.example/api');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  it('asks for the registration page for Create account', async () => {
    const res = await call('/api/auth/sign-in?return_to=%2Fnew&screen=sign-up');
    const location = new URL(res.headers.get('Location')!);
    expect(location.searchParams.get('prompt')).toBe('create');
  });

  it('keeps the verifier in an HttpOnly cookie scoped to /api/auth', async () => {
    const { res } = await signInCookie();
    const pkce = setCookies(res).find((c) => c.startsWith('ld_pkce='))!;
    expect(pkce).toContain('HttpOnly');
    expect(pkce).toContain('Secure');
    expect(pkce).toContain('Path=/api/auth');
    expect(pkce).toContain('Max-Age=600');
  });

  it('returns to AUTH_ORIGIN when set (local dev behind the router)', async () => {
    const res = await call('/api/auth/sign-in', {
      env: { ...ENV, AUTH_ORIGIN: 'http://localhost:3100/' },
    });
    const location = new URL(res.headers.get('Location')!);
    expect(location.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3100/api/auth/callback',
    );
  });
});

describe('GET /api/auth/callback', () => {
  async function callback(opts: { state?: string; cookie?: string } = {}) {
    const { location, pkce } = await signInCookie();
    const state = opts.state ?? location.searchParams.get('state')!;
    return call(`/api/auth/callback?code=the-code&state=${state}`, {
      headers: { Cookie: `other=1; ld_pkce=${opts.cookie ?? pkce}` },
    });
  }

  it('swaps the code with the client secret, keeps the refresh token, and goes back', async () => {
    fetchMock.mockResolvedValue(tokenResponse());
    const res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/document/abc');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(sentUrl(url)).toBe('https://accounts.example/api/auth/oauth2/token');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Basic ${btoa('client-lp:shh')}`);
    const body = sentForm(init);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBeTruthy();

    expect(cookieValue(res, 'ld_refresh')).toBe('refresh-2');
    const refresh = setCookies(res).find((c) => c.startsWith('ld_refresh='))!;
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('SameSite=Strict');
    expect(cookieValue(res, 'ld_pkce')).toBe('');
    // The page-readable hint, site-wide and not HttpOnly, holding nothing secret.
    const hint = setCookies(res).find((c) => c.startsWith('ld_signed_in='))!;
    expect(hint).toContain('ld_signed_in=1;');
    expect(hint).toContain('Path=/;');
    expect(hint).not.toContain('HttpOnly');
  });

  it('counts the completed sign-in once (docs/specs/017-telemetry/telemetry.md)', async () => {
    fetchMock.mockResolvedValue(tokenResponse());
    await callback();
    expect(reportSignIn).toHaveBeenCalledWith(ENV, 'user_abc');
    expect(waitUntil).toHaveBeenCalled();
  });

  it('refuses a state that does not match, without swapping anything', async () => {
    const res = await callback({ state: 'forged' });
    expect(res.headers.get('Location')).toBe('/sign-in?error=expired');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieValue(res, 'ld_refresh')).toBeUndefined();
  });

  it('refuses a callback with no sign-in cookie', async () => {
    const res = await call('/api/auth/callback?code=c&state=s');
    expect(res.headers.get('Location')).toBe('/sign-in?error=expired');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the browser back to sign in when the swap fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const res = await callback();
    expect(res.headers.get('Location')).toBe('/sign-in?error=failed');
    expect(cookieValue(res, 'ld_refresh')).toBeUndefined();
    warn.mockRestore();
  });
});

describe('POST /api/auth/token', () => {
  it('answers 401 signed out without a refresh cookie, calling nobody', async () => {
    const res = await call('/api/auth/token', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ signedIn: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes, rotates the cookie, and hands the page an access token and its account', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ refresh_token: 'refresh-3' }));
    const res = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      signedIn: true,
      accessToken: 'access-1',
      user: { id: 'user_abc', email: 'ada@example.com', name: 'Ada Lovelace' },
    });
    expect(typeof body.expiresAt).toBe('number');
    expect(cookieValue(res, 'ld_refresh')).toBe('refresh-3');
    const sent = sentForm(fetchMock.mock.calls[0]![1]);
    expect(sent.get('grant_type')).toBe('refresh_token');
    expect(sent.get('refresh_token')).toBe('refresh-2');
    expect(sent.get('resource')).toBe('https://lp.example/api');
  });

  it('signs out, dropping the cookie, when the refresh is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const res = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=stale' },
    });
    expect(res.status).toBe(401);
    expect(cookieValue(res, 'ld_refresh')).toBe('');
    expect(cookieValue(res, 'ld_signed_in')).toBe('0');
    warn.mockRestore();
  });
});

describe('POST /api/auth/sign-out', () => {
  it('drops the refresh cookie and the hint', async () => {
    const res = await call('/api/auth/sign-out', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(cookieValue(res, 'ld_refresh')).toBe('');
    expect(cookieValue(res, 'ld_signed_in')).toBe('0');
  });
});

describe('GET /api/auth/guest', () => {
  it("sends the browser to the accounts site's guest handoff with this app's client, coming back to /auth/guest", async () => {
    const res = await call('/api/auth/guest?state=abcdefgh12');
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get('Location')!);
    expect(`${to.origin}${to.pathname}`).toBe('https://accounts.example/api/auth/guest');
    expect(Object.fromEntries(to.searchParams)).toEqual({
      client_id: 'client-lp',
      redirect_uri: 'https://lp.example/auth/guest',
      state: 'abcdefgh12',
      resource: 'https://lp.example/api',
    });
    expect(setCookies(res)).toEqual([]);
  });

  it('comes straight back, saying so, on a deployment with no accounts site', async () => {
    const res = await call('/api/auth/guest?state=abcdefgh12', { env: {} as Env });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(
      'https://lp.example/auth/guest#error=guest_not_configured&state=abcdefgh12',
    );
  });

  it('refuses a missing or odd state rather than redirect with it', async () => {
    for (const q of ['', '?state=short', '?state=has%20space%20in%20it']) {
      expect((await call(`/api/auth/guest${q}`)).status, q).toBe(400);
    }
  });
});

describe('the /api/auth surface', () => {
  it('answers 404 on a guest-only deployment', async () => {
    const res = await call('/api/auth/sign-in', { env: {} as Env });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'sign_in_not_configured' });
  });

  it('answers 404 to an unknown step or method', async () => {
    expect((await call('/api/auth/elsewhere')).status).toBe(404);
    expect((await call('/api/auth/token')).status).toBe(404);
    expect((await call('/api/auth/sign-in/extra')).status).toBe(404);
  });

  it('is rate limited per network', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await call('/api/auth/token', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
      env: { ...ENV, WRITE_RATE_LIMITER: { limit } } as unknown as Env,
    });
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'auth:203.0.113.9' });
  });
});

describe('the account name cookie (ld_account)', () => {
  // liveworkspace/docs/accounts.md "An app's signed-in cookies": who is signed in, for the marketing header.
  const named = (claims: Record<string, unknown>) =>
    tokenResponse({ id_token: jwt({ sub: 'user_abc', email: 'ada@example.com', ...claims }) });

  it('names the account beside the hint at sign-in, readable on the whole site', async () => {
    const { location, pkce } = await signInCookie();
    fetchMock.mockResolvedValue(named({ name: 'Ada Lovelace', given_name: 'Ada' }));
    const res = await call(
      `/api/auth/callback?code=c&state=${location.searchParams.get('state')}`,
      { headers: { Cookie: `ld_pkce=${pkce}` } },
    );
    expect(cookieValue(res, 'ld_account')).toBe('Ada');
    const name = setCookies(res).find((c) => c.startsWith('ld_account='))!;
    expect(name).toContain('Path=/;');
    expect(name).not.toContain('HttpOnly');
  });

  it('names it afresh at every refresh, encoded, falling back to the full name and then the email', async () => {
    fetchMock.mockResolvedValueOnce(named({ name: 'Ada Lovelace' }));
    const full = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(cookieValue(full, 'ld_account')).toBe(encodeURIComponent('Ada Lovelace'));

    fetchMock.mockResolvedValueOnce(named({}));
    const email = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(cookieValue(email, 'ld_account')).toBe(encodeURIComponent('ada@example.com'));
  });

  // liveworkspace/docs/accounts.md "Profile pictures".
  it("keeps the account's Google picture beside it, and says when Show My Google Picture is off", async () => {
    const picture = 'https://lh3.googleusercontent.com/a/ada=s96-c';
    fetchMock.mockResolvedValueOnce(named({ name: 'Ada', picture, picture_hidden: true }));
    const shown = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(cookieValue(shown, 'ld_account_picture')).toBe(encodeURIComponent(picture));
    const body: { user: { picture: unknown; pictureHidden: unknown } } = await shown.json();
    expect(body.user).toMatchObject({ picture, pictureHidden: true });

    fetchMock.mockResolvedValueOnce(named({ name: 'Ada', picture: 'https://evil.example/a.png' }));
    const foreign = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(cookieValue(foreign, 'ld_account_picture')).toBe('');
    const none: { user: { picture: unknown; pictureHidden: unknown } } = await foreign.json();
    expect(none.user).toMatchObject({ picture: null, pictureHidden: false });
  });

  it("keeps the profile's presence colour beside it, and clears it with none or at sign-out", async () => {
    fetchMock.mockResolvedValueOnce(named({ name: 'Ada', presence_color: '#0ea5e9' }));
    const coloured = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(cookieValue(coloured, 'ld_account_colour')).toBe(encodeURIComponent('#0ea5e9'));
    const body: { user: { color: unknown } } = await coloured.json();
    expect(body.user.color).toBe('#0ea5e9');

    fetchMock.mockResolvedValueOnce(named({ name: 'Ada' }));
    const automatic = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=refresh-2' },
    });
    expect(cookieValue(automatic, 'ld_account_colour')).toBe('');

    const out = await call('/api/auth/sign-out', { method: 'POST' });
    expect(setCookies(out).find((c) => c.startsWith('ld_account_colour='))).toContain('Max-Age=0');
  });

  it('clears it when the refresh is refused and at sign-out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const refused = await call('/api/auth/token', {
      method: 'POST',
      headers: { Cookie: 'ld_refresh=stale' },
    });
    expect(cookieValue(refused, 'ld_account')).toBe('');
    warn.mockRestore();

    const out = await call('/api/auth/sign-out', { method: 'POST' });
    expect(cookieValue(out, 'ld_account')).toBe('');
    expect(setCookies(out).find((c) => c.startsWith('ld_account='))).toContain('Max-Age=0');
  });
});

describe('safeReturnPath', () => {
  // The cases live with the one check, in @liveworkspace/auth-client/return-path; this binds the Explorer fallback.
  it('keeps a path on this site and sends anything else to the Explorer', () => {
    expect(safeReturnPath('/document/abc?tab=1')).toBe('/document/abc?tab=1');
    for (const unsafe of [null, '//evil.example', '/\t/evil.example']) {
      expect(safeReturnPath(unsafe)).toBe('/explorer/home');
    }
  });
});

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    const req = new Request(APP, { headers: { Cookie: 'a=1; ld_refresh=xyz ; b=2' } });
    expect(readCookie(req, 'ld_refresh')).toBe('xyz');
    expect(readCookie(req, 'missing')).toBeNull();
  });
});

// Signing in without a click (liveworkspace/docs/accounts.md "Signing in without a click"): the page's boot
// script sends a browser with no session here once per browser session; it always comes back to where it was.
describe('GET /api/auth/silent', () => {
  async function bounce(
    returnTo = '/explorer/home?x=1#card',
    init: RequestInit & { env?: Env } = {},
  ) {
    return call(`/api/auth/silent?return=${encodeURIComponent(returnTo)}`, init);
  }

  it('asks the accounts site with prompt=none, guarding against a second bounce', async () => {
    const res = await bounce();
    const location = new URL(res.headers.get('Location')!);
    expect(location.origin + location.pathname).toBe(
      'https://accounts.example/api/auth/oauth2/authorize',
    );
    expect(location.searchParams.get('prompt')).toBe('none');
    expect(location.searchParams.get('redirect_uri')).toBe(`${APP}/api/auth/callback`);
    expect(cookieValue(res, 'ld_silent')).toBe('1');
    expect(cookieValue(res, 'ld_silent_pkce')).toBeTruthy();
    // A clicked sign-in in another tab keeps its own cookie.
    expect(cookieValue(res, 'ld_pkce')).toBeUndefined();
  });

  it('goes straight back after the person signed out of this app', async () => {
    const res = await bounce('/new', { headers: { Cookie: 'ld_signed_out=1' } });
    expect(res.headers.get('Location')).toBe('/new');
  });

  it('goes straight back on a guest-only deployment, never to an error page', async () => {
    const res = await bounce('/new', { env: {} as Env });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/new');
  });

  it('goes straight back when rate limited', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await bounce('/new', {
      env: { ...ENV, WRITE_RATE_LIMITER: { limit } } as unknown as Env,
    });
    expect(res.headers.get('Location')).toBe('/new');
  });

  async function comeBack(query: (state: string) => string) {
    const out = await bounce();
    const state = new URL(out.headers.get('Location')!).searchParams.get('state')!;
    return call(`/api/auth/callback?${query(state)}`, {
      headers: { Cookie: `ld_silent_pkce=${cookieValue(out, 'ld_silent_pkce')}` },
    });
  }

  it('signs in at the callback when the accounts site had a session, back to the same address', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse());
    const res = await comeBack((state) => `code=c1&state=${state}`);
    expect(res.headers.get('Location')).toBe('/explorer/home?x=1#card');
    expect(cookieValue(res, 'ld_refresh')).toBe('refresh-2');
    expect(cookieValue(res, 'ld_signed_in')).toBe('1');
    expect(cookieValue(res, 'ld_signed_out')).toBe('');
    expect(cookieValue(res, 'ld_silent_pkce')).toBe('');
    expect(reportSignIn).toHaveBeenCalledWith(expect.anything(), 'user_abc');
  });

  it('comes back a guest on login_required, swapping nothing', async () => {
    const res = await comeBack((state) => `error=login_required&state=${state}`);
    expect(res.headers.get('Location')).toBe('/explorer/home?x=1#card');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieValue(res, 'ld_refresh')).toBeUndefined();
    expect(cookieValue(res, 'ld_silent_pkce')).toBe('');
  });
});

describe('signing out, and signing in again', () => {
  it('remembers an explicit sign-out, so no silent sign-in undoes it', async () => {
    const res = await call('/api/auth/sign-out', { method: 'POST' });
    expect(cookieValue(res, 'ld_signed_out')).toBe('1');
    const out = setCookies(res).find((c) => c.startsWith('ld_signed_out='))!;
    expect(out).toContain('Path=/');
    expect(out).not.toContain('HttpOnly');
  });

  it('forgets it at the next clicked sign-in', async () => {
    const { location, pkce } = await signInCookie();
    fetchMock.mockResolvedValueOnce(tokenResponse());
    const res = await call(
      `/api/auth/callback?code=c1&state=${location.searchParams.get('state')}`,
      { headers: { Cookie: `ld_pkce=${pkce}; ld_signed_out=1` } },
    );
    expect(cookieValue(res, 'ld_signed_out')).toBe('');
  });
});
