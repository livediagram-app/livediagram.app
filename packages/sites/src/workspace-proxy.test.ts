import { describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_ROUTE,
  EXPLORER_ON_APP_ORIGIN,
  EXPLORER_ROUTE,
  locationOnApp,
  PRODUCTION_WORKSPACE_ORIGIN,
  routeToWorkspace,
  WORKSPACE_PROXY_HEADER,
  workspaceRouteFor,
  workspaceRoutes,
  ACCOUNTS_ROUTE,
  FLOW_COOKIE_MAX_AGE_SECONDS,
  flowCookieOut,
  flowCookiesIn,
  SIGN_IN_PAGE_ROUTES,
  SITE_ASSETS_ROUTE,
  WORKSPACE_CLIENT_IP_HEADER,
} from './workspace-proxy';
import { APP_NAMES } from './index';

const ROUTES = [EXPLORER_ROUTE, ACCOUNT_ROUTE];

function upstream(
  answer: Response = new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
) {
  return vi.fn<typeof fetch>(async () => answer);
}

describe('which paths go to liveworkspace', () => {
  it.each([
    ['/explorer', EXPLORER_ROUTE],
    ['/explorer/', EXPLORER_ROUTE],
    ['/explorer/recent', EXPLORER_ROUTE],
    ['/explorer.txt', EXPLORER_ROUTE],
    ['/explorer/recent/__next._tree.txt', EXPLORER_ROUTE],
    ['/api/workspace/account/people', ACCOUNT_ROUTE],
    ['/explorers', null],
    ['/explorer-guide', null],
    ['/api/account', null],
    ['/api/workspace', null],
    ['/project/explorer', null],
  ])('%s', (path, route) => {
    expect(workspaceRouteFor(path, ROUTES)).toBe(route);
  });

  it('is the Explorer and its account reads for an app switched on, and signing in for every app', () => {
    const signIn = [...SIGN_IN_PAGE_ROUTES, ACCOUNTS_ROUTE, SITE_ASSETS_ROUTE];
    for (const app of APP_NAMES) {
      expect(workspaceRoutes(app)).toEqual(
        EXPLORER_ON_APP_ORIGIN[app] ? [...ROUTES, ...signIn] : signIn,
      );
    }
    expect(EXPLORER_ON_APP_ORIGIN.liveplanner).toBe(true);
    expect(EXPLORER_ON_APP_ORIGIN.livedesign).toBe(true);
    expect(EXPLORER_ON_APP_ORIGIN.livedocuments).toBe(true);
    expect(EXPLORER_ON_APP_ORIGIN.livediagram).toBe(true);
  });

  it('answers null for a path it does not own, so the router carries on', () => {
    const doFetch = upstream();
    expect(
      routeToWorkspace(new Request('https://liveplanner.app/project/p1'), {
        app: 'liveplanner',
        fetch: doFetch,
      }),
    ).toBeNull();
    expect(
      routeToWorkspace(new Request('https://livediagram.app/document/d1'), {
        app: 'livediagram',
        fetch: doFetch,
      }),
    ).toBeNull();
    expect(doFetch).not.toHaveBeenCalled();
  });
});

describe('forwarding', () => {
  it('keeps the path and the query, and asks production when no origin is named', async () => {
    const doFetch = upstream();
    const res = await routeToWorkspace(
      new Request('https://liveplanner.app/explorer/team?id=t1&folder=f2#x'),
      { app: 'liveplanner', fetch: doFetch },
    );
    expect(res?.status).toBe(200);
    const sent = doFetch.mock.calls[0]![0] as Request;
    expect(sent.url).toBe(`${PRODUCTION_WORKSPACE_ORIGIN}/explorer/team?id=t1&folder=f2`);
    expect(sent.headers.get(WORKSPACE_PROXY_HEADER)).toBe('liveplanner');
    expect(sent.headers.get('X-Forwarded-Host')).toBe('liveplanner.app');
    expect(sent.redirect).toBe('manual');
  });

  it('goes to the named origin (staging, local)', async () => {
    const doFetch = upstream();
    await routeToWorkspace(new Request('http://localhost:3200/explorer.txt?_rsc=1'), {
      app: 'liveplanner',
      origin: 'http://localhost:3000',
      fetch: doFetch,
    });
    expect((doFetch.mock.calls[0]![0] as Request).url).toBe(
      'http://localhost:3000/explorer.txt?_rsc=1',
    );
  });

  it("drops the app's cookies on the way out and liveworkspace's on the way back", async () => {
    const doFetch = upstream(
      new Response('{}', { headers: { 'Set-Cookie': 'better-auth.session=x; Path=/' } }),
    );
    const res = await routeToWorkspace(
      new Request('https://liveplanner.app/api/workspace/account/people?ids=a', {
        headers: { Cookie: 'lp_refresh=secret', Authorization: 'Bearer t' },
      }),
      { app: 'liveplanner', fetch: doFetch },
    );
    const sent = doFetch.mock.calls[0]![0] as Request;
    expect(sent.url).toBe(`${PRODUCTION_WORKSPACE_ORIGIN}/api/account/people?ids=a`);
    expect(sent.headers.get('Cookie')).toBeNull();
    expect(sent.headers.get('Authorization')).toBe('Bearer t');
    expect(res?.headers.get('Set-Cookie')).toBeNull();
  });

  it('passes a write with its body', async () => {
    const doFetch = upstream(new Response('{}'));
    await routeToWorkspace(
      new Request('https://livedesign.app/api/workspace/account/settings/livedesign.app', {
        method: 'PATCH',
        body: JSON.stringify({ app: { homeBanner: false } }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { app: 'livedesign', fetch: doFetch },
    );
    const sent = doFetch.mock.calls[0]![0] as Request;
    expect(sent.method).toBe('PATCH');
    expect(await sent.text()).toBe('{"app":{"homeBanner":false}}');
  });

  it('keeps cookies both ways on a route that asks to', async () => {
    const doFetch = upstream(new Response('', { headers: { 'Set-Cookie': 's=1' } }));
    const route = { prefix: '/sign-in', target: '/sign-in', cookies: 'pass' as const };
    const res = await routeToWorkspace(
      new Request('https://liveplanner.app/sign-in', { headers: { Cookie: 'a=1' } }),
      { app: 'liveplanner', routes: [route], fetch: doFetch },
    );
    expect((doFetch.mock.calls[0]![0] as Request).headers.get('Cookie')).toBe('a=1');
    expect(res?.headers.get('Set-Cookie')).toBe('s=1');
  });
});

describe('redirects stay on the app', () => {
  it.each([
    ['/explorer/recent', '/explorer/recent'],
    ['https://liveworkspace.app/explorer/recent?x=1', '/explorer/recent?x=1'],
    ['https://liveworkspace.app/api/account/people', '/api/workspace/account/people'],
    // Elsewhere on liveworkspace (the account pages): left for the browser to go there.
    ['https://liveworkspace.app/account/teams', 'https://liveworkspace.app/account/teams'],
    ['https://www.liveplanner.app/project/p1', 'https://www.liveplanner.app/project/p1'],
    ['/sign-in?return=%2Fexplorer', '/sign-in?return=%2Fexplorer'],
  ])('%s → %s', (location, expected) => {
    expect(locationOnApp(location, PRODUCTION_WORKSPACE_ORIGIN, ROUTES)).toBe(expected);
  });

  it('rewrites the Location of a forwarded redirect', async () => {
    const doFetch = upstream(
      new Response(null, {
        status: 307,
        headers: { Location: 'https://liveworkspace.app/explorer/recent' },
      }),
    );
    const res = await routeToWorkspace(new Request('https://liveplanner.app/explorer/recent/'), {
      app: 'liveplanner',
      fetch: doFetch,
    });
    expect(res?.status).toBe(307);
    expect(res?.headers.get('Location')).toBe('/explorer/recent');
  });
});

describe('no loops', () => {
  it('refuses a request already forwarded once', async () => {
    const doFetch = upstream();
    const res = await routeToWorkspace(
      new Request('https://liveplanner.app/explorer', {
        headers: { [WORKSPACE_PROXY_HEADER]: 'liveplanner' },
      }),
      { app: 'liveplanner', fetch: doFetch },
    );
    expect(res?.status).toBe(508);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it('refuses when the origin named is the router itself', async () => {
    const doFetch = upstream();
    const res = await routeToWorkspace(new Request('http://localhost:3200/explorer'), {
      app: 'liveplanner',
      origin: 'http://localhost:3200',
      fetch: doFetch,
    });
    expect(res?.status).toBe(508);
    expect(doFetch).not.toHaveBeenCalled();
  });
});

describe("signing in on the app's own address", () => {
  const routes = workspaceRoutes('livediagram');

  it.each([
    ['https://livediagram.app/sign-in?client_id=c&sig=s', '/sign-in'],
    ['https://livediagram.app/sign-up?client_id=c&prompt=create&sig=s', '/sign-up'],
    ['https://livediagram.app/consent?sig=s', '/consent'],
    ['https://livediagram.app/api/workspace/auth/sign-in/email-otp', '/api/workspace/auth'],
    // The app's own sign-in hand-off page, and its own auth routes, stay the app's.
    ['https://livediagram.app/sign-in/?redirect_url=%2Fexplorer', null],
    ['https://livediagram.app/sign-in', null],
    ['https://livediagram.app/sign-in.txt', null],
    ['https://livediagram.app/api/auth/callback?code=c&state=s', null],
    ['https://livediagram.app/get-started/', null],
    ['https://livediagram.app/_liveworkspace/_next/static/chunks/a.js', '/_liveworkspace'],
    ['https://livediagram.app/_next/static/chunks/a.js', null],
  ])('%s', (address, prefix) => {
    const url = new URL(address);
    expect(workspaceRouteFor(url.pathname, routes, url)?.prefix ?? null).toBe(prefix);
  });

  it("sends liveworkspace only the sign-in's own cookies, under their own names", async () => {
    const doFetch = upstream(new Response('{}'));
    await routeToWorkspace(
      new Request('https://livediagram.app/api/workspace/auth/get-session', {
        headers: {
          Cookie:
            'ld_refresh=secret; lw_flow.__Secure-better-auth.session_token=tok.sig; ld_signed_in=1',
        },
      }),
      { app: 'livediagram', fetch: doFetch },
    );
    const sent = doFetch.mock.calls[0]![0] as Request;
    expect(sent.url).toBe('https://liveworkspace.app/api/auth/get-session');
    expect(sent.headers.get('Cookie')).toBe('__Secure-better-auth.session_token=tok.sig');

    await routeToWorkspace(
      new Request('https://livediagram.app/api/workspace/auth/get-session', {
        headers: { Cookie: 'ld_refresh=secret' },
      }),
      { app: 'livediagram', fetch: doFetch },
    );
    expect((doFetch.mock.calls[1]![0] as Request).headers.has('Cookie')).toBe(false);
  });

  it("keeps liveworkspace's session on the app's address only on the auth path, and briefly", async () => {
    const headers = new Headers();
    headers.append(
      'Set-Cookie',
      '__Secure-better-auth.session_token=tok.sig; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    headers.append('Set-Cookie', 'lw_guest=g; Domain=liveworkspace.app; Path=/; Max-Age=0');
    const doFetch = upstream(new Response('{}', { headers }));
    const response = await routeToWorkspace(
      new Request('https://livediagram.app/api/workspace/auth/sign-in/email-otp', {
        method: 'POST',
      }),
      { app: 'livediagram', fetch: doFetch },
    )!;
    expect(response.headers.getSetCookie()).toEqual([
      `lw_flow.__Secure-better-auth.session_token=tok.sig; Path=/api/workspace/auth; Max-Age=${FLOW_COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      'lw_flow.lw_guest=; Path=/api/workspace/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ]);
  });

  it('clears a cookie liveworkspace expires by date, and refuses names that could smuggle attributes', () => {
    expect(
      flowCookieOut('a=b; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/', '/api/workspace/auth'),
    ).toMatch(/^lw_flow\.a=; .*Max-Age=0;/);
    expect(flowCookieOut('a=b; Max-Age=60', '/p')).toContain('Max-Age=60;');
    expect(flowCookieOut('=b', '/p')).toBeNull();
    expect(flowCookieOut('a b=c', '/p')).toBeNull();
    expect(flowCookiesIn('x=1; y=2')).toBeNull();
    expect(flowCookiesIn(null)).toBeNull();
  });

  it("names the visitor's network, and never one the visitor made up", async () => {
    const doFetch = upstream(new Response('{}'));
    await routeToWorkspace(
      new Request('https://livediagram.app/api/workspace/auth/sign-in/email-otp', {
        headers: { 'CF-Connecting-IP': '203.0.113.9' },
      }),
      { app: 'livediagram', fetch: doFetch },
    );
    expect((doFetch.mock.calls[0]![0] as Request).headers.get(WORKSPACE_CLIENT_IP_HEADER)).toBe(
      '203.0.113.9',
    );
    await routeToWorkspace(
      new Request('https://livediagram.app/api/workspace/auth/sign-in/email-otp', {
        headers: { [WORKSPACE_CLIENT_IP_HEADER]: '198.51.100.1' },
      }),
      { app: 'livediagram', fetch: doFetch },
    );
    expect((doFetch.mock.calls[1]![0] as Request).headers.has(WORKSPACE_CLIENT_IP_HEADER)).toBe(
      false,
    );
  });

  it("passes the pages' cookies neither way", async () => {
    const doFetch = upstream(new Response('<html>', { headers: { 'Set-Cookie': 'x=1; Path=/' } }));
    const response = await routeToWorkspace(
      new Request('https://livediagram.app/sign-in?sig=s', { headers: { Cookie: 'ld_refresh=r' } }),
      { app: 'livediagram', fetch: doFetch },
    )!;
    expect((doFetch.mock.calls[0]![0] as Request).headers.has('Cookie')).toBe(false);
    expect(response.headers.has('Set-Cookie')).toBe(false);
  });

  it("brings a redirect to a sign-in page back to the app's address", () => {
    expect(locationOnApp('/sign-in?sig=s', PRODUCTION_WORKSPACE_ORIGIN, routes)).toBe(
      '/sign-in?sig=s',
    );
    expect(
      locationOnApp('https://liveworkspace.app/sign-up?sig=s', PRODUCTION_WORKSPACE_ORIGIN, routes),
    ).toBe('/sign-up?sig=s');
    expect(
      locationOnApp('https://accounts.google.com/o/oauth2', PRODUCTION_WORKSPACE_ORIGIN, routes),
    ).toBe('https://accounts.google.com/o/oauth2');
  });
});
