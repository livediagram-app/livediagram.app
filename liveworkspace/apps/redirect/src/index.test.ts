import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { movedCookies } from './moved-cookies';

// liveworkspace.app's bare domain (liveworkspace/docs/specs/010-site/site.md "www. is the address").

const SESSION = '__Secure-better-auth.session_token';
const signedSession = 'tok3n.c2lnbmF0dXJlLW9mLXRoZS10b2tlbg%3D%3D';

function site() {
  const seen: Request[] = [];
  const SITE = {
    fetch: async (request: Request) => {
      seen.push(request);
      return new Response('from the site', { status: 200 });
    },
  } as unknown as Fetcher;
  return { SITE, seen };
}

const call = (href: string, init: RequestInit, env: Parameters<typeof worker.fetch>[1]) =>
  worker.fetch(new Request(href, init), env);

afterEach(() => vi.unstubAllGlobals());

describe('the bare domain in production', () => {
  it('sends a page load to www. in one cacheable 301, never asking the site', async () => {
    const { SITE, seen } = site();
    const res = await call('https://liveworkspace.app/explorer/recent?x=1', {}, { SITE });
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://www.liveworkspace.app/explorer/recent?x=1');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(seen).toEqual([]);
  });

  it('where it lands never redirects again: www. goes straight to the site', async () => {
    const { SITE, seen } = site();
    const first = await call('https://liveworkspace.app/sign-in?client_id=a&sig=b', {}, { SITE });
    const second = await call(first.headers.get('Location')!, {}, { SITE });
    expect(second.status).toBe(200);
    expect(seen.map((r) => r.url)).toEqual([
      'https://www.liveworkspace.app/sign-in?client_id=a&sig=b',
    ]);
  });

  it('moves a session from before the move in the same hop, and keeps that answer out of every cache', async () => {
    const { SITE } = site();
    const res = await call(
      'https://liveworkspace.app/explorer',
      { headers: { Cookie: `theme=dark; ${SESSION}=${signedSession}; lw_guest=guest_1.mac` } },
      { SITE },
    );
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://www.liveworkspace.app/explorer');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.getSetCookie()).toEqual([
      `${SESSION}=${signedSession}; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=liveworkspace.app; Max-Age=604800`,
      'lw_guest=guest_1.mac; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=liveworkspace.app; Max-Age=315360000',
    ]);
  });

  it('passes the APIs, discovery, other methods, WebSockets and a router’s forward to the site untouched', async () => {
    const { SITE, seen } = site();
    const cases: [string, RequestInit][] = [
      ['https://liveworkspace.app/api/auth/oauth2/token', { method: 'POST' }],
      ['https://liveworkspace.app/.well-known/security.txt', {}],
      [
        'https://liveworkspace.app/sign-in',
        { method: 'POST', headers: { Authorization: 'Bearer t' } },
      ],
      ['https://liveworkspace.app/', { headers: { Upgrade: 'websocket' } }],
      [
        'https://liveworkspace.app/explorer',
        { headers: { 'X-Liveworkspace-Proxy': 'liveplanner' } },
      ],
    ];
    for (const [href, init] of cases) {
      const res = await call(href, init, { SITE });
      expect(res.status, href).toBe(200);
    }
    expect(seen.map((r) => r.url)).toEqual(cases.map(([href]) => href));
    // Authorization reaches the site as it was sent: nothing is redirected that carries one.
    expect(seen[2]!.headers.get('Authorization')).toBe('Bearer t');
  });
});

describe('staging and local development', () => {
  it('never redirect, even with the production host in request.url (wrangler dev hands it the route’s)', async () => {
    const { SITE, seen } = site();
    const staging = await call('https://liveworkspace.app/', {}, { SITE, DEPLOY_ENV: 'staging' });
    expect(staging.status).toBe(200);
    expect(seen).toHaveLength(1);

    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      fetched.push(request.url);
      return new Response('local site');
    });
    const local = await call(
      'https://liveworkspace.app/explorer?x=1',
      {},
      { DEPLOY_ENV: 'local', SITE_ORIGIN: 'http://localhost:3000' },
    );
    expect(local.status).toBe(200);
    expect(fetched).toEqual(['http://localhost:3000/explorer?x=1']);
  });

  it('answers 503 with nowhere to send a request', async () => {
    const res = await call('https://liveworkspace.app/', {}, { DEPLOY_ENV: 'local' });
    expect(res.status).toBe(503);
  });
});

describe('movedCookies', () => {
  it('moves only the session, dont_remember and guest cookies, each set once on the domain', () => {
    expect(movedCookies(null)).toEqual([]);
    expect(movedCookies('a=1; b=2; =x; junk')).toEqual([]);
    expect(movedCookies('__Secure-better-auth.dont_remember=yes.sig')).toEqual([
      '__Secure-better-auth.dont_remember=yes.sig; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=liveworkspace.app',
    ]);
  });

  it('leaves a name sent twice (it already has its domain copy) and an empty value alone', () => {
    expect(movedCookies(`${SESSION}=old.sig; ${SESSION}=new.sig`)).toEqual([]);
    expect(movedCookies(`${SESSION}=`)).toEqual([]);
  });
});
