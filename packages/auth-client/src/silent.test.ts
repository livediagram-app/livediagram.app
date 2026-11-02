import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  finishSilentSignIn,
  signedOutCookie,
  signOutSilentCookies,
  silentCookieNames,
  silentCookiesForHint,
  silentSignInBootScript,
  SILENT_RETRY_GLOBAL,
  SILENT_RETURN_ATTRIBUTE,
  SILENT_RETURN_KEY,
  SILENT_SESSION_KEY,
  retrySilentSignIn,
  startSilentSignIn,
} from './silent';

const cookies = silentCookieNames('lp_', 'lp_signed_in');
const APP = 'https://liveplanner.app';
const config = {
  accountsUrl: 'https://liveworkspace.app',
  clientId: 'client-1',
  resource: `${APP}/api`,
};
const credentials = { ...config, clientSecret: 's3cret' };
const callbackUrl = `${APP}/api/auth/callback`;

const setCookies = (res: Response) => res.headers.getSetCookie();
const cookieValue = (res: Response, name: string) =>
  setCookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0]!
    .slice(name.length + 1);

afterEach(() => vi.restoreAllMocks());

// The boot script, run against stub globals: what it would navigate to, or null when it stays put.
type Page = {
  path?: string;
  search?: string;
  hash?: string;
  cookie?: string;
  inFrame?: boolean;
  userAgent?: string;
  storage?: Map<string, string> | 'blocked';
  cookieEnabled?: boolean;
  webdriver?: boolean;
  apiBase?: string;
  afterPaint?: boolean;
  readyState?: 'loading' | 'complete';
  prerendering?: boolean;
  idleCallback?: boolean;
  // The page that opened this one (`document.referrer`); the page itself is on https://liveplanner.app.
  referrer?: string;
};

function boot(page: Page = {}) {
  const script = silentSignInBootScript({
    apiBase: page.apiBase ?? '/api',
    cookies,
    skipPaths: ['/sign-in', '/embed', '/auth'],
    afterPaint: page.afterPaint,
  });
  const went: string[] = [];
  let stopped = false;
  const storage = page.storage ?? new Map<string, string>();
  const sessionStorage =
    storage === 'blocked'
      ? {
          getItem: () => {
            throw new Error('SecurityError');
          },
          setItem: () => {
            throw new Error('SecurityError');
          },
        }
      : {
          getItem: (k: string) => storage.get(k) ?? null,
          setItem: (k: string, v: string) => void storage.set(k, v),
          removeItem: (k: string) => void storage.delete(k),
        };
  const listeners: Record<string, (() => void)[]> = {};
  const timers: (() => void)[] = [];
  const window: Record<string, unknown> = {
    sessionStorage,
    stop: () => {
      stopped = true;
    },
    addEventListener: (type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    },
    setTimeout: (fn: () => void) => void timers.push(fn),
  };
  if (page.idleCallback !== false) {
    window.requestIdleCallback = (fn: () => void, options: { timeout: number }) => {
      expect(options.timeout).toBe(1000);
      timers.push(fn);
    };
  }
  window.self = window;
  window.top = page.inFrame ? {} : window;
  const location = {
    protocol: 'https:',
    host: 'liveplanner.app',
    pathname: page.path ?? '/explorer/home',
    search: page.search ?? '',
    hash: page.hash ?? '',
    replace: (to: string) => void went.push(to),
    reload: () => {},
  };
  const attributes = new Map<string, string>();
  const documentListeners: Record<string, (() => void)[]> = {};
  const document = {
    cookie: page.cookie ?? '',
    referrer: page.referrer ?? '',
    visibilityState: 'visible',
    addEventListener: (type: string, fn: () => void) => {
      (documentListeners[type] ??= []).push(fn);
    },
    readyState: page.readyState ?? 'loading',
    prerendering: page.prerendering ?? false,
    documentElement: {
      style: {} as Record<string, string>,
      setAttribute: (k: string, v: string) => void attributes.set(k, v),
    },
  };
  const navigator = {
    cookieEnabled: page.cookieEnabled ?? true,
    webdriver: page.webdriver ?? false,
    userAgent: page.userAgent ?? 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15',
  };
  new Function('window', 'document', 'location', 'navigator', script)(
    window,
    document,
    location,
    navigator,
  );
  // Runs what the page has queued: the load event, then the timers and idle callbacks it schedules.
  const settle = () => {
    for (const fn of listeners.load ?? []) fn();
    while (timers.length) timers.shift()!();
    return went[0] ?? null;
  };
  const fire = (type: string) => {
    for (const fn of listeners[type] ?? []) fn();
  };
  // The tab hidden, then shown again (the person was in another tab or app).
  const comeBack = () => {
    for (const state of ['hidden', 'visible']) {
      document.visibilityState = state;
      for (const fn of documentListeners.visibilitychange ?? []) fn();
    }
  };
  // What the page's first token answer does (retrySilentSignIn): whatever the page went to by then, or null.
  const retry = () => {
    const again = window[SILENT_RETRY_GLOBAL];
    if (typeof again === 'function') (again as () => void)();
    return went[0] ?? null;
  };
  return {
    to: went[0] ?? null,
    went,
    stopped,
    comeBack,
    retry,
    hasRetry: () => typeof window[SILENT_RETRY_GLOBAL] === 'function',
    storage,
    scheme: document.documentElement.style.colorScheme,
    attributes,
    settle,
    fire,
    setCookie: (cookie: string) => void (document.cookie = cookie),
  };
}

describe('the boot script, after the page paints (a marketing page)', () => {
  it('lets the page load, then bounces once it is idle, keeping the address', () => {
    const page = boot({ afterPaint: true, path: '/features/diagrams', search: '?a=1', hash: '#x' });
    // Nothing stops the page, and nothing goes before it has loaded.
    expect(page.stopped).toBe(false);
    expect(page.to).toBeNull();
    expect(page.scheme).toBeUndefined();
    expect(page.settle()).toBe(
      `/api/auth/silent?return=${encodeURIComponent('/features/diagrams?a=1#x')}`,
    );
    const storage = page.storage as Map<string, string>;
    expect(storage.get(SILENT_SESSION_KEY)).toBe('1');
    expect(storage.get(SILENT_RETURN_KEY)).toBe('/features/diagrams?a=1');
  });

  it('waits on a timer where there is no idle callback, and goes at once on a page already loaded', () => {
    expect(boot({ afterPaint: true, idleCallback: false }).settle()).not.toBeNull();
    expect(boot({ afterPaint: true, readyState: 'complete' }).settle()).not.toBeNull();
  });

  it('is called off once the visitor starts using the page, and asks again on the next one', () => {
    const storage = new Map<string, string>();
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      const page = boot({ afterPaint: true, storage });
      page.fire(type);
      expect(page.settle()).toBeNull();
    }
    expect(storage.has(SILENT_SESSION_KEY)).toBe(false);
    expect(boot({ afterPaint: true, storage }).settle()).not.toBeNull();
  });

  it('stays put when a session or a sign-out arrives before it goes', () => {
    const page = boot({ afterPaint: true });
    page.setCookie('lp_signed_in=1');
    expect(page.settle()).toBeNull();
  });

  it('bounces once per tab, never from a prerender, and never past the usual guards', () => {
    const storage = new Map([[SILENT_SESSION_KEY, '1']]);
    expect(boot({ afterPaint: true, storage }).settle()).toBeNull();
    expect(boot({ afterPaint: true, prerendering: true }).settle()).toBeNull();
    expect(boot({ afterPaint: true, cookie: 'lp_signed_in=1' }).settle()).toBeNull();
    expect(boot({ afterPaint: true, webdriver: true }).settle()).toBeNull();
    expect(boot({ afterPaint: true, path: '/sign-in' }).settle()).toBeNull();
    expect(boot({ afterPaint: true, search: '?s=CODE' }).settle()).toBeNull();
    expect(boot({ afterPaint: true, search: `?q=${'x'.repeat(2000)}` }).settle()).toBeNull();
    expect(boot({ afterPaint: true, storage: 'blocked' }).settle()).toBeNull();
  });

  it('marks the page it lands back on, once, so it is not counted twice', () => {
    // @liveworkspace/ui's trackers read the attribute by this name (packages/ui/src/silent-return.ts).
    expect(SILENT_RETURN_ATTRIBUTE).toBe('data-silent-return');
    const storage = new Map([
      [SILENT_SESSION_KEY, '1'],
      [SILENT_RETURN_KEY, '/features/diagrams?a=1'],
    ]);
    const back = boot({ afterPaint: true, storage, path: '/features/diagrams', search: '?a=1' });
    expect(back.attributes.has(SILENT_RETURN_ATTRIBUTE)).toBe(true);
    expect(storage.has(SILENT_RETURN_KEY)).toBe(false);
    // The next page in the tab is a page of its own.
    expect(
      boot({ afterPaint: true, storage, path: '/features/diagrams', search: '?a=1' }).attributes
        .size,
    ).toBe(0);
    // Landed somewhere else (the address changed on the way): not the same page.
    storage.set(SILENT_RETURN_KEY, '/features/diagrams?a=1');
    expect(boot({ afterPaint: true, storage, path: '/' }).attributes.size).toBe(0);
    expect(storage.has(SILENT_RETURN_KEY)).toBe(false);
  });
});

describe('the cookies a sign-out sets', () => {
  it('sets no mark when the liveworkspace session ended, only the guard', () => {
    expect(signOutSilentCookies(cookies, true)).toEqual([
      signedOutCookie(cookies, false),
      expect.stringMatching(/^lp_silent=1; .*Max-Age=120$/),
    ]);
  });

  it('marks a sign-out of this app alone', () => {
    expect(signOutSilentCookies(cookies, false)).toEqual([signedOutCookie(cookies, true)]);
    expect(signedOutCookie(cookies, true)).toMatch(/^lp_signed_out=2; /);
  });
});

describe('silentCookiesForHint', () => {
  it("names an app's cookies from its hint", () => {
    expect(silentCookiesForHint('ldoc_signed_in')).toEqual({
      hint: 'ldoc_signed_in',
      signedOut: 'ldoc_signed_out',
      guard: 'ldoc_silent',
      pkce: 'ldoc_silent_pkce',
    });
    expect(() => silentCookiesForHint('session')).toThrow();
  });
});

describe('the boot script', () => {
  it('bounces a browser with no session here, keeping the path, query and hash', () => {
    const { to, stopped, storage, scheme } = boot({
      path: '/project/abc',
      search: '?tab=2',
      hash: '#card-9',
    });
    expect(to).toBe(`/api/auth/silent?return=${encodeURIComponent('/project/abc?tab=2#card-9')}`);
    // Nothing else of the page loads, so no app code runs and nothing signed-out paints.
    expect(stopped).toBe(true);
    expect(scheme).toBe('light dark');
    expect((storage as Map<string, string>).get(SILENT_SESSION_KEY)).toBe('1');
  });

  it('bounces once per tab', () => {
    const storage = new Map<string, string>();
    expect(boot({ storage }).to).not.toBeNull();
    expect(boot({ storage }).to).toBeNull();
    // A page reached from the app's own pages keeps the mark.
    expect(boot({ storage, referrer: 'https://liveplanner.app/project/abc' }).to).toBeNull();
    expect(boot({ storage, referrer: 'https://liveplanner.app' }).to).toBeNull();
  });

  it('asks again on the next load after the tab comes back into view, since the person may have signed in elsewhere', () => {
    const storage = new Map<string, string>();
    expect(boot({ storage }).to).not.toBeNull();
    const page = boot({ storage });
    expect(page.to).toBeNull();
    page.comeBack();
    // Not under the person's hands: the page they are on stays, the next one asks.
    expect(page.went).toEqual([]);
    expect(boot({ storage }).to).not.toBeNull();
    expect(boot({ storage }).to).toBeNull();
  });

  it('asks again on a page opened from another site, since the tab may have been through a sign-in there', () => {
    const storage = new Map<string, string>();
    expect(boot({ storage }).to).not.toBeNull();
    expect(boot({ storage, referrer: 'https://www.livediagram.app/' }).to).not.toBeNull();
    // The way back from a bounce (the guard up) is no visit to another site, whatever the accounts site's address.
    expect(
      boot({ storage, cookie: 'lp_silent=1', referrer: 'https://www.liveworkspace.app/' }).to,
    ).toBeNull();
    expect(storage.get(SILENT_SESSION_KEY)).toBe('1');
    // Another site whose address only starts with this one's.
    storage.set(SILENT_SESSION_KEY, '1');
    expect(boot({ storage, referrer: 'https://liveplanner.app.example/' }).to).not.toBeNull();
  });

  it('still never asks again within two minutes of a bounce, nor in a tab whose storage is blocked', () => {
    const storage = new Map<string, string>([[SILENT_SESSION_KEY, '1']]);
    const page = boot({ storage, cookie: 'lp_silent=1', referrer: 'https://www.livediagram.app/' });
    expect(page.to).toBeNull();
    page.comeBack();
    expect(boot({ storage, cookie: 'lp_silent=1' }).to).toBeNull();
    expect(boot({ storage: 'blocked', referrer: 'https://www.livediagram.app/' }).to).toBeNull();
  });

  it('stays put with a session here already', () => {
    expect(boot({ cookie: 'a=1; lp_signed_in=1' }).to).toBeNull();
    // A session that ended (the hint `0`) is asked about again.
    expect(boot({ cookie: 'lp_signed_in=0' }).to).not.toBeNull();
    // Another app's hint on the same host isn't this one's.
    expect(boot({ cookie: 'xlp_signed_in=1; lp_signed_inx=1' }).to).not.toBeNull();
    // Nor is a value that only starts with the mark.
    expect(boot({ cookie: 'lp_signed_in=10' }).to).not.toBeNull();
  });

  it('stays put after the person signed out of this app alone', () => {
    expect(boot({ cookie: 'lp_signed_out=2' }).to).toBeNull();
    expect(boot({ cookie: 'lp_signed_out=' }).to).not.toBeNull();
    // A mark from before signing out became global no longer blocks it.
    expect(boot({ cookie: 'lp_signed_out=1' }).to).not.toBeNull();
  });

  it('stays put while a bounce is out (the loop guard)', () => {
    expect(boot({ cookie: 'lp_silent=1' }).to).toBeNull();
  });

  it('never bounces inside a frame', () => {
    expect(boot({ inFrame: true }).to).toBeNull();
  });

  it('never bounces an automated browser', () => {
    expect(boot({ webdriver: true }).to).toBeNull();
  });

  it('is left out when the API is on another origin, since the way back is a path', () => {
    expect(
      silentSignInBootScript({ apiBase: 'http://localhost:8887/api', cookies, skipPaths: [] }),
    ).toBe('');
    expect(silentSignInBootScript({ apiBase: '//api.example', cookies, skipPaths: [] })).toBe('');
  });

  it('never bounces a crawler', () => {
    for (const userAgent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0)',
      'facebookexternalhit/1.1',
      'Slackbot-LinkExpanding 1.0',
      'Mozilla/5.0 (Linux; Android 11) Chrome/120.0 Mobile Safari/537.36 Chrome-Lighthouse',
    ]) {
      expect(boot({ userAgent }).to).toBeNull();
    }
  });

  it('never bounces the sign-in pages, embeds, or the paths under them', () => {
    expect(boot({ path: '/sign-in' }).to).toBeNull();
    expect(boot({ path: '/embed/workbench/explorer' }).to).toBeNull();
    expect(boot({ path: '/auth/guest' }).to).toBeNull();
    expect(boot({ path: '/sign-inside' }).to).not.toBeNull();
  });

  it('never interrupts a share link', () => {
    expect(boot({ path: '/project/abc', search: '?s=CODE' }).to).toBeNull();
    expect(boot({ path: '/project/abc', search: '?view=1&s=CODE' }).to).toBeNull();
    expect(boot({ path: '/project/abc', search: '?share=1' }).to).not.toBeNull();
  });

  it('does nothing without storage or cookies to guard it', () => {
    expect(boot({ storage: 'blocked' }).to).toBeNull();
    expect(boot({ cookieEnabled: false }).to).toBeNull();
  });

  it('leaves an address too long to carry alone', () => {
    expect(boot({ search: `?q=${'x'.repeat(2000)}` }).to).toBeNull();
  });

  it('refuses names that would break out of the script', () => {
    expect(() =>
      silentSignInBootScript({
        apiBase: '/api',
        cookies: { ...cookies, hint: "x');alert(1);('" },
        skipPaths: [],
      }),
    ).toThrow();
    expect(() =>
      silentSignInBootScript({ apiBase: '/api', cookies, skipPaths: ["/a'"] }),
    ).toThrow();
  });
});

function start(query: string, cookie?: string, withConfig = true) {
  return startSilentSignIn({
    request: new Request(`${APP}/api/auth/silent?${query}`, {
      headers: cookie ? { cookie } : {},
    }),
    config: withConfig ? config : null,
    callbackUrl,
    fallbackReturn: '/explorer/home',
    cookies,
  });
}

describe('GET /api/auth/silent', () => {
  it('asks the accounts site with prompt=none and sets the guard', async () => {
    const res = await start(`return=${encodeURIComponent('/project/abc?x=1#h')}`);
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get('location')!);
    expect(`${to.origin}${to.pathname}`).toBe(
      'https://liveworkspace.app/api/auth/oauth2/authorize',
    );
    expect(to.searchParams.get('prompt')).toBe('none');
    expect(to.searchParams.get('redirect_uri')).toBe(callbackUrl);
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
    expect(cookieValue(res, 'lp_silent')).toBe('1');
    const pkce = setCookies(res).find((c) => c.startsWith('lp_silent_pkce='))!;
    expect(pkce).toContain('HttpOnly');
    expect(pkce).toContain('Path=/api/auth');
  });

  it('goes straight back after an explicit sign-out, or with a bounce already out', async () => {
    for (const cookie of ['lp_signed_out=2', 'lp_silent=1']) {
      const res = await start('return=/project/abc', cookie);
      expect(res.headers.get('location')).toBe('/project/abc');
      expect(setCookies(res)).toEqual([]);
    }
  });

  it('bounces past a mark from before signing out became global', async () => {
    const res = await start('return=/project/abc', 'lp_signed_out=1');
    expect(new URL(res.headers.get('location')!).searchParams.get('prompt')).toBe('none');
  });

  it('goes straight back with no sign-in configured, guarding against another try', async () => {
    const res = await start('return=/new', undefined, false);
    expect(res.headers.get('location')).toBe('/new');
    expect(cookieValue(res, 'lp_silent')).toBe('1');
  });

  it('never goes back off the site', async () => {
    // A tab, newline or space would be dropped by the browser, leaving `//evil.example`.
    const dropped = ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/ /evil.example'];
    for (const bad of [
      '//evil.example',
      'https://evil.example',
      '/\\evil.example',
      '',
      ...dropped,
    ]) {
      const res = await start(`return=${encodeURIComponent(bad)}`, 'lp_silent=1');
      expect(res.headers.get('location')).toBe('/explorer/home');
    }
  });
});

describe('the callback, coming back from a bounce', () => {
  async function bounced(returnTo = '/project/abc#h') {
    const res = await start(`return=${encodeURIComponent(returnTo)}`);
    const state = new URL(res.headers.get('location')!).searchParams.get('state')!;
    return { state, pkce: cookieValue(res, 'lp_silent_pkce')! };
  }

  function finish(query: string, pkce: string, fetchImpl?: typeof fetch) {
    return finishSilentSignIn({
      request: new Request(`${callbackUrl}?${query}`, {
        headers: { cookie: `other=1; lp_silent_pkce=${pkce}` },
      }),
      credentials,
      resource: config.resource,
      callbackUrl,
      cookies,
      fetchImpl,
    });
  }

  it('signs in with the code and clears the signed-out mark', async () => {
    const { state, pkce } = await bounced();
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ access_token: 'a', refresh_token: 'r', expires_in: 600 }),
    );
    const done = await finish(`code=c1&state=${state}`, pkce, fetchImpl);
    expect(done?.returnTo).toBe('/project/abc#h');
    expect(done?.tokens?.refreshToken).toBe('r');
    expect(done?.cookies.some((c) => c.startsWith('lp_silent_pkce=;'))).toBe(true);
    expect(done?.cookies).toContain(signedOutCookie(cookies, false));
    const body = new URLSearchParams(String(fetchImpl.mock.calls[0]![1]!.body));
    expect(body.get('code')).toBe('c1');
    expect(body.get('redirect_uri')).toBe(callbackUrl);
  });

  it('comes back a guest on login_required, with no request to the accounts site', async () => {
    const { state, pkce } = await bounced();
    const fetchImpl = vi.fn<typeof fetch>();
    const done = await finish(`error=login_required&state=${state}`, pkce, fetchImpl);
    expect(done).toEqual({
      returnTo: '/project/abc#h',
      tokens: null,
      cookies: [expect.stringMatching(/^lp_silent_pkce=;/)],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('comes back a guest when the code swap fails', async () => {
    const { state, pkce } = await bounced();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const done = await finish(
      `code=c1&state=${state}`,
      pkce,
      vi.fn<typeof fetch>(async () => new Response('no', { status: 400 })),
    );
    expect(done?.tokens).toBeNull();
    expect(done?.returnTo).toBe('/project/abc#h');
  });

  it("leaves a clicked sign-in's callback alone", async () => {
    const { pkce } = await bounced();
    expect(await finish('code=c1&state=someone-else', pkce)).toBeNull();
    expect(await finish('code=c1&state=x', '')).toBeNull();
  });
});

describe('a hint that outlived its session (retrySilentSignIn)', () => {
  const asked = new Map<string, string>([[SILENT_SESSION_KEY, '1']]);

  it('asks once the first token answer clears a hint the page loaded with, past the tab mark', () => {
    const page = boot({
      cookie: 'lp_signed_in=1',
      storage: new Map(asked),
      path: '/explorer/home',
      search: '?a=1',
    });
    expect(page.to).toBeNull();
    page.setCookie('lp_signed_in=0');
    expect(page.retry()).toBe(
      `/api/auth/silent?return=${encodeURIComponent('/explorer/home?a=1')}`,
    );
    // Once per page, whoever calls.
    page.retry();
    expect(page.went).toHaveLength(1);
    expect((page.storage as Map<string, string>).get(SILENT_SESSION_KEY)).toBe('1');
  });

  it('stays put while the session holds, or for a guest whose hint was never 1', () => {
    const signedIn = boot({ cookie: 'lp_signed_in=1' });
    expect(signedIn.retry()).toBeNull();
    // A session that holds uses the retry up, so a later refusal (the session ending under the open page) can't
    // reload it.
    signedIn.setCookie('lp_signed_in=0');
    expect(signedIn.retry()).toBeNull();
    const guest = boot({ storage: new Map(asked) });
    expect(guest.to).toBeNull();
    expect(guest.retry()).toBeNull();
  });

  it('keeps every other guard: the signed-out mark, the loop guard, skipped pages, frames and crawlers', () => {
    for (const after of ['lp_signed_in=0; lp_signed_out=2', 'lp_signed_in=0; lp_silent=1']) {
      const page = boot({ cookie: 'lp_signed_in=1' });
      page.setCookie(after);
      expect(page.retry()).toBeNull();
    }
    const share = boot({ cookie: 'lp_signed_in=1', search: '?s=CODE' });
    share.setCookie('lp_signed_in=0');
    expect(share.retry()).toBeNull();
    expect(boot({ cookie: 'lp_signed_in=1', path: '/sign-in' }).hasRetry()).toBe(false);
    expect(boot({ cookie: 'lp_signed_in=1', inFrame: true }).hasRetry()).toBe(false);
    expect(boot({ cookie: 'lp_signed_in=1', webdriver: true }).hasRetry()).toBe(false);
    const long = boot({ cookie: 'lp_signed_in=1', search: `?q=${'x'.repeat(2000)}` });
    long.setCookie('lp_signed_in=0');
    expect(long.retry()).toBeNull();
    const blocked = boot({ cookie: 'lp_signed_in=1', storage: 'blocked' });
    blocked.setCookie('lp_signed_in=0');
    expect(blocked.retry()).toBeNull();
  });

  it('on a marketing page, goes at once unless the visitor started using it, and marks the way back', () => {
    const page = boot({ afterPaint: true, cookie: 'lp_signed_in=1', path: '/pricing' });
    page.setCookie('lp_signed_in=0');
    expect(page.retry()).toBe(`/api/auth/silent?return=${encodeURIComponent('/pricing')}`);
    expect((page.storage as Map<string, string>).get(SILENT_RETURN_KEY)).toBe('/pricing');
    const used = boot({ afterPaint: true, cookie: 'lp_signed_in=1' });
    used.fire('pointerdown');
    used.setCookie('lp_signed_in=0');
    expect(used.retry()).toBeNull();
  });

  it('calls the function the boot script left, and is a no-op on a page without one', () => {
    const global = globalThis as Record<string, unknown>;
    const again = vi.fn();
    global[SILENT_RETRY_GLOBAL] = again;
    try {
      retrySilentSignIn();
      expect(again).toHaveBeenCalledTimes(1);
      global[SILENT_RETRY_GLOBAL] = () => {
        throw new Error('boom');
      };
      expect(() => retrySilentSignIn()).not.toThrow();
    } finally {
      delete global[SILENT_RETRY_GLOBAL];
    }
    expect(() => retrySilentSignIn()).not.toThrow();
  });
});
