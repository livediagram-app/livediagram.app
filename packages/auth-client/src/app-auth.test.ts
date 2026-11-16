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
import {
  GUEST_RENEWAL_COOKIE,
  GUEST_RENEWAL_COOKIE_MAX_AGE_SECONDS,
  guestRenewalCookie,
  guestRenewalPage,
  renewalToken,
} from './guest-renewal';
import { TOKEN_REQUEST_TIMEOUT_MS } from './oauth';

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
  it('gives the user the family name beside the given name', async () => {
    const id = jwt({ sub: 'u', given_name: 'Ada', family_name: ' Lovelace ' });
    fetchMock.mockResolvedValueOnce(tokenResponse(id));
    const withFamily = routes();
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

describe('GET /api/auth/guest renewing a token the page holds (accounts.md "Renewing without the cookie")', () => {
  const state = 'state-12345';
  const token = 'aaa.bbb.ccc';

  it('answers a page posting the token in a form body to the same handoff address, and clears the cookie', async () => {
    const auth = routes();
    const plain = await call(auth, `/api/auth/guest?state=${state}`);
    expect(plain.status).toBe(302);
    const action = plain.headers.get('Location')!;
    expect(new URL(action).searchParams.has('guest_token')).toBe(false);

    const page = await call(auth, `/api/auth/guest?state=${state}`, {
      headers: { Cookie: `${GUEST_RENEWAL_COOKIE}=${token}` },
    });
    expect(page.status).toBe(200);
    expect(page.headers.get('Location')).toBeNull();
    expect(page.headers.get('Cache-Control')).toBe('no-store');
    // Its POST must carry the app's Origin, which no-referrer would send as null.
    expect(page.headers.get('Referrer-Policy')).toBe('strict-origin');
    expect(page.headers.get('X-Frame-Options')).toBe('DENY');
    const csp = page.headers.get('Content-Security-Policy')!;
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    expect(csp).toContain("default-src 'none'");
    expect(page.headers.getSetCookie()).toEqual([guestRenewalCookie(null)]);
    const html = await page.text();
    expect(html).toContain(`action="${action.replaceAll('&', '&amp;')}"`);
    expect(html).toContain('method="post"');
    expect(html).toContain(`name="guest_token" value="${token}"`);
    expect(html).toContain(`<script nonce="${nonce}">`);
  });

  it('hands off as before with a cookie that is not a token, or on a guest-only deployment', async () => {
    const auth = routes();
    for (const value of ['nope', '"><script>x</script>', `${'a'.repeat(2001)}.b.c`]) {
      const response = await call(auth, `/api/auth/guest?state=${state}`, {
        headers: { Cookie: `${GUEST_RENEWAL_COOKIE}=${value}` },
      });
      expect(response.status).toBe(302);
    }
    const bare = await call(
      auth,
      `/api/auth/guest?state=${state}`,
      { headers: { Cookie: `${GUEST_RENEWAL_COOKIE}=${token}` } },
      {},
    );
    expect(bare.headers.get('Location')).toMatch(/^\/auth\/guest#error=guest_not_configured/);
  });
});

describe('the renewal cookie and page', () => {
  it('sets the cookie for a minute on the guest door, Strict, and clears it', () => {
    expect(guestRenewalCookie('t.t.t')).toBe(
      `lw_guest_renewal=t.t.t; Path=/api/auth/guest; Max-Age=${GUEST_RENEWAL_COOKIE_MAX_AGE_SECONDS}; Secure; SameSite=Strict`,
    );
    expect(guestRenewalCookie(null, '/x/auth/guest')).toBe(
      'lw_guest_renewal=; Path=/x/auth/guest; Max-Age=0; Secure; SameSite=Strict',
    );
    expect(renewalToken(null)).toBeNull();
    expect(renewalToken('a.b.')).toBe('a.b.');
  });

  it('escapes what it writes into the page', async () => {
    const html = await guestRenewalPage('https://a.example/?x="<y>&z', 'a.b.c').text();
    expect(html).toContain('action="https://a.example/?x=&quot;&lt;y&gt;&amp;z"');
  });
});

describe('POST /api/auth/token when the accounts site is slow or bound (accounts.md "When the accounts site doesn\'t answer")', () => {
  const post = { method: 'POST', headers: { Cookie: 'x_refresh=r1' } };
  const setCookies = (res: Response) => res.headers.getSetCookie().join('\n');
  // AbortSignal.timeout runs on the runtime's own clock, not vitest's: the test fires it, and checks its budget.
  function stallClock() {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    return {
      fire: () => controller.abort(new DOMException('timed out', 'TimeoutError')),
      budget: () => timeout.mock.calls[0]?.[0],
    };
  }

  it('answers 503 within the budget and keeps every cookie when the refresh stalls', async () => {
    const clock = stallClock();
    // A fetch that never answers on its own, only to its signal (the stall of 2026-11-15).
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const pending = call(routes(), '/api/auth/token', post);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(clock.budget()).toBe(TOKEN_REQUEST_TIMEOUT_MS);
    expect(TOKEN_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(8_000);
    clock.fire();
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'accounts_unreachable' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(setCookies(res)).toBe('');
  });

  it('answers 503 with the cookies kept on a 5xx, a network error or a body that is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('down', { status: 502 }));
    const bad = await call(routes(), '/api/auth/token', post);
    expect(bad.status).toBe(503);
    expect(setCookies(bad)).toBe('');
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    const offline = await call(routes(), '/api/auth/token', post);
    expect(offline.status).toBe(503);
    expect(setCookies(offline)).toBe('');
    fetchMock.mockRejectedValueOnce('not an error');
    expect((await call(routes(), '/api/auth/token', post)).status).toBe(503);
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    expect((await call(routes(), '/api/auth/token', post)).status).toBe(503);
  });

  it('still signs out on a 4xx from the accounts site, or an answer without a token', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const res = await call(routes(), '/api/auth/token', post);
    expect(res.status).toBe(401);
    expect(setCookies(res)).toContain('x_refresh=;');
    expect(setCookies(res)).toContain('x_signed_in=0');
    fetchMock.mockResolvedValueOnce(Response.json({}));
    expect((await call(routes(), '/api/auth/token', post)).status).toBe(401);
  });

  // Work Tracker 1007: a refresh token whose session ended (a global sign-out from another app) is no sign-out of this
  // app alone, so the signed-out mark stays unset and the silent sign-in that follows still asks the accounts site.
  it('leaves the signed-out mark alone on a refused refresh, so the silent sign-in still asks', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: 'invalid_grant', error_description: 'session not found' },
        { status: 400 },
      ),
    );
    const res = await call(routes(), '/api/auth/token', post);
    expect(res.status).toBe(401);
    expect(setCookies(res)).not.toContain('x_signed_out=');
    expect(setCookies(res)).not.toContain('x_silent=');
    const bounce = await call(routes(), '/api/auth/silent?return=%2Fdocument%2Fd1', {
      headers: { Cookie: 'x_signed_in=0' },
    });
    expect(bounce.status).toBe(302);
    expect(bounce.headers.get('location')).toMatch(
      /^https:\/\/accounts\.example\/api\/auth\/oauth2\/authorize\?.*prompt=none/,
    );
  });

  it('goes through the ACCOUNTS binding when there is one, the public route only when it throws', async () => {
    const id = jwt({ sub: 'u' });
    const bound = vi.fn(async (_input: string, _init?: RequestInit) => tokenResponse(id));
    const res = await call(routes(), '/api/auth/token', post, {
      ...ENV,
      ACCOUNTS: { fetch: bound },
    });
    expect(res.status).toBe(200);
    expect(bound.mock.calls[0]?.[0]).toBe('https://accounts.example/api/auth/oauth2/token');
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(tokenResponse(id));
    const broken = vi.fn(async (_input: string, _init?: RequestInit): Promise<Response> => {
      throw new Error('no such service');
    });
    const fallback = await call(routes(), '/api/auth/token', post, {
      ...ENV,
      ACCOUNTS: { fetch: broken },
    });
    expect(fallback.status).toBe(200);
    expect(broken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('never falls back to the public route once the request timed out', async () => {
    const clock = stallClock();
    const stalled = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const pending = call(routes(), '/api/auth/token', post, {
      ...ENV,
      ACCOUNTS: { fetch: stalled },
    });
    await vi.waitFor(() => expect(stalled).toHaveBeenCalled());
    clock.fire();
    expect((await pending).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swaps the code and signs out through the binding too', async () => {
    const bound = vi.fn(
      async (_input: string, _init?: RequestInit) => new Response('{}', { status: 500 }),
    );
    const env = { ...ENV, ACCOUNTS: { fetch: bound } };
    const signedOut = await call(
      routes(),
      '/api/auth/sign-out?return=/a',
      { method: 'POST', headers: { Cookie: 'x_refresh=r1' } },
      env,
    );
    expect(signedOut.status).toBe(200);
    expect(bound.mock.calls[0]?.[0]).toBe('https://accounts.example/api/auth/end-session');
    const pkce = encodeUtf8PkceCookie({ state: 's', verifier: 'v', returnTo: '/a' });
    const back = await call(
      routes(),
      '/api/auth/callback?code=c&state=s',
      { headers: { Cookie: `x_pkce=${pkce}` } },
      env,
    );
    expect(back.headers.get('Location')).toBe('/sign-in?error=failed');
    expect(bound.mock.calls[1]?.[0]).toBe('https://accounts.example/api/auth/oauth2/token');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
