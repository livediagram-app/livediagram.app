import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  OPEN_EXPLORER_COOKIE,
  OPEN_EXPLORER_MAX_AGE_SECONDS,
  OPEN_EXPLORER_TARGET,
  hasOpenExplorerCookie,
  openExplorerCookie,
  openExplorerBootScript,
  openExplorerRedirect,
  syncOpenExplorerCookie,
} from './open-explorer';

// Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer").
const HOME = 'https://www.livediagram.app/';
const ON = `${OPEN_EXPLORER_COOKIE}=1`;

function answer(href: string, headers: Record<string, string> = {}, method = 'GET') {
  return openExplorerRedirect(new Request(href, { method, headers }), new URL(href), {
    signedInCookie: 'ld_signed_in',
  });
}

const signedIn = {
  Cookie: `ld_signed_in=1; ${ON}`,
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Dest': 'document',
};

describe('openExplorerRedirect', () => {
  it('sends a signed-in person with the switch on from the homepage to the Explorer, never cached', () => {
    const res = answer(HOME, signedIn);
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe(OPEN_EXPLORER_TARGET);
    expect(res?.headers.get('Cache-Control')).toBe('no-store');
    expect(res?.headers.get('Vary')).toBe('Cookie');
  });

  it('leaves the homepage be without the cookie, or with another cookie of a similar name', () => {
    expect(answer(HOME, { ...signedIn, Cookie: 'ld_signed_in=1' })).toBeNull();
    expect(answer(HOME, { ...signedIn, Cookie: `ld_signed_in=1; x${ON}` })).toBeNull();
    expect(
      answer(HOME, { ...signedIn, Cookie: `ld_signed_in=1; ${OPEN_EXPLORER_COOKIE}=0` }),
    ).toBeNull();
  });

  it('needs the signed-in hint when the product names one', () => {
    expect(answer(HOME, { ...signedIn, Cookie: ON })).toBeNull();
    expect(answer(HOME, { ...signedIn, Cookie: `ld_signed_in=0; ${ON}` })).toBeNull();
    const bare = openExplorerRedirect(
      new Request(HOME, { headers: { Cookie: ON } }),
      new URL(HOME),
    );
    expect(bare?.status).toBe(302);
  });

  it('answers only the homepage itself, by GET', () => {
    for (const path of ['/faq', '/explorer', '/explorer/home', '/index.txt', '/pricing/']) {
      expect(answer(`https://www.livediagram.app${path}`, signedIn)).toBeNull();
    }
    expect(answer(HOME, signedIn, 'HEAD')).toBeNull();
    expect(answer(HOME, signedIn, 'POST')).toBeNull();
  });

  it('shows the homepage for any query, `?home` the way back', () => {
    expect(answer(`${HOME}?home`, signedIn)).toBeNull();
    expect(answer(`${HOME}?utm_source=x`, signedIn)).toBeNull();
  });

  it('leaves a link inside the site be', () => {
    expect(answer(HOME, { ...signedIn, 'Sec-Fetch-Site': 'same-origin' })).toBeNull();
    expect(answer(HOME, { ...signedIn, 'Sec-Fetch-Site': 'cross-site' })?.status).toBe(302);
    expect(answer(HOME, { ...signedIn, 'Sec-Fetch-Site': 'same-site' })?.status).toBe(302);
    // A browser without Sec-Fetch-Site: the Referer decides.
    const { 'Sec-Fetch-Site': _site, ...noFetchSite } = signedIn;
    expect(answer(HOME, { ...noFetchSite, Referer: 'https://www.livediagram.app/faq' })).toBeNull();
    expect(answer(HOME, { ...noFetchSite, Referer: 'https://example.com/' })?.status).toBe(302);
    expect(
      answer(HOME, { ...noFetchSite, Referer: 'https://www.livediagram.app.example.com/' })?.status,
    ).toBe(302);
    expect(answer(HOME, noFetchSite)?.status).toBe(302);
  });

  it('answers page navigations only, not a fetch or a frame', () => {
    expect(answer(HOME, { ...signedIn, 'Sec-Fetch-Dest': 'empty' })).toBeNull();
    expect(answer(HOME, { ...signedIn, 'Sec-Fetch-Dest': 'iframe' })).toBeNull();
    const { 'Sec-Fetch-Dest': _dest, ...noDest } = signedIn;
    expect(answer(HOME, noDest)?.status).toBe(302);
  });

  it('stays a header test however long the Cookie header is', () => {
    const long = `${'a=b; '.repeat(2000)}ld_signed_in=1; ${ON}`;
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) answer(HOME, { ...signedIn, Cookie: long });
    });
    expect(spent).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('hasOpenExplorerCookie', () => {
  it('reads its own pair anywhere in the header', () => {
    expect(hasOpenExplorerCookie(null)).toBe(false);
    expect(hasOpenExplorerCookie('')).toBe(false);
    expect(hasOpenExplorerCookie(ON)).toBe(true);
    expect(hasOpenExplorerCookie(`a=1;${ON};b=2`)).toBe(true);
    expect(hasOpenExplorerCookie(`a=1; ${ON}1`)).toBe(false);
  });
});

describe('openExplorerCookie', () => {
  it('sets a long-lived, site-wide, Lax cookie, Secure on https', () => {
    expect(openExplorerCookie(true, true)).toBe(
      `${ON}; Max-Age=${OPEN_EXPLORER_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`,
    );
    expect(openExplorerCookie(true, false)).toBe(
      `${ON}; Max-Age=${OPEN_EXPLORER_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`,
    );
  });

  it('clears it with Max-Age=0', () => {
    expect(openExplorerCookie(false, true)).toBe(
      `${OPEN_EXPLORER_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`,
    );
  });
});

describe('syncOpenExplorerCookie', () => {
  function fakeDocument(cookie: string, protocol = 'https:') {
    const writes: string[] = [];
    return {
      writes,
      location: { protocol },
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        writes.push(value);
      },
    };
  }

  it('writes the cookie while the setting is on, renewing it every time', () => {
    const doc = fakeDocument(ON);
    syncOpenExplorerCookie(true, doc);
    expect(doc.writes).toEqual([openExplorerCookie(true, true)]);
    const local = fakeDocument('', 'http:');
    syncOpenExplorerCookie(true, local);
    expect(local.writes).toEqual([openExplorerCookie(true, false)]);
  });

  it('clears the cookie when the setting goes off, and writes nothing when there is none', () => {
    const doc = fakeDocument(`a=1; ${ON}`);
    syncOpenExplorerCookie(false, doc);
    expect(doc.writes).toEqual([openExplorerCookie(false, true)]);
    const none = fakeDocument('a=1');
    syncOpenExplorerCookie(false, none);
    expect(none.writes).toEqual([]);
  });

  it("writes the page's own document when none is given", () => {
    const doc = fakeDocument('');
    vi.stubGlobal('document', doc);
    try {
      syncOpenExplorerCookie(true);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(doc.writes).toEqual([openExplorerCookie(true, true)]);
  });

  it('does nothing outside a browser, and survives a browser refusing cookies', () => {
    expect(() => syncOpenExplorerCookie(true, undefined)).not.toThrow();
    const refusing = {
      location: { protocol: 'https:' },
      get cookie(): string {
        throw new Error('SecurityError');
      },
      set cookie(_value: string) {
        throw new Error('SecurityError');
      },
    };
    expect(() => syncOpenExplorerCookie(true, refusing)).not.toThrow();
    expect(() => syncOpenExplorerCookie(false, refusing)).not.toThrow();
  });
});

describe('openExplorerBootScript', () => {
  function run(href: string, cookie: string, referrer = '') {
    const url = new URL(href);
    const replaced: string[] = [];
    const location = {
      pathname: url.pathname,
      search: url.search,
      origin: url.origin,
      replace: (to: string) => replaced.push(to),
    };
    new Function('location', 'document', openExplorerBootScript())(location, { cookie, referrer });
    return replaced;
  }

  it('opens the Explorer from the homepage with the cookie set', () => {
    expect(run('https://www.liveworkspace.app/', `a=1; ${ON}`)).toEqual([OPEN_EXPLORER_TARGET]);
    expect(run('https://www.liveworkspace.app/', ON, 'https://example.com/')).toEqual([
      OPEN_EXPLORER_TARGET,
    ]);
  });

  it('stays on the homepage without the cookie, with a query, from inside the site, or on any other page', () => {
    expect(run('https://www.liveworkspace.app/', 'a=1')).toEqual([]);
    expect(run('https://www.liveworkspace.app/?home', ON)).toEqual([]);
    expect(
      run('https://www.liveworkspace.app/', ON, 'https://www.liveworkspace.app/compare'),
    ).toEqual([]);
    expect(run('https://www.liveworkspace.app/explorer/home', ON)).toEqual([]);
    expect(run('https://www.livediagram.app/explorer/recent', ON)).toEqual([]);
  });
});
