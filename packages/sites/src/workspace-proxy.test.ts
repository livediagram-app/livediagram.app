import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_ROUTE,
  explorerHomeHref,
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
  forwardToIndex,
  forwardToDrive,
  isDrivePath,
  PRODUCTION_DRIVE_ORIGIN,
  PRODUCTION_INDEX_ORIGIN,
  WORKBENCH_ROUTE,
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

  it('is the Explorer and its account reads, signing in and workbenches, for every app', () => {
    const signIn = [...SIGN_IN_PAGE_ROUTES, ACCOUNTS_ROUTE, SITE_ASSETS_ROUTE, WORKBENCH_ROUTE];
    for (const app of APP_NAMES) {
      expect(workspaceRoutes(app)).toEqual([...ROUTES, ...signIn]);
      expect(explorerHomeHref(app)).toBe('/explorer/home');
    }
  });

  it('sends /api/workbench/* to the accounts Worker, naming the app, with no cookies', async () => {
    const doFetch = upstream(new Response('{}', { status: 201 }));
    const answered = await routeToWorkspace(
      new Request('https://liveplanner.app/api/workbench/tickets?x=1', {
        method: 'POST',
        headers: { Authorization: 'Bearer lwt_x', Cookie: 'session=1' },
        body: '{"projectId":"p1"}',
      }),
      { app: 'liveplanner', fetch: doFetch },
    );
    expect(answered?.status).toBe(201);
    const sent = doFetch.mock.calls[0]![0] as Request;
    expect(sent.url).toBe(`${PRODUCTION_WORKSPACE_ORIGIN}/api/account/workbench/tickets?x=1`);
    expect(sent.method).toBe('POST');
    expect(sent.headers.get(WORKSPACE_PROXY_HEADER)).toBe('liveplanner');
    expect(sent.headers.get('Authorization')).toBe('Bearer lwt_x');
    expect(sent.headers.get('Cookie')).toBeNull();
    expect(await sent.text()).toBe('{"projectId":"p1"}');
    expect(workspaceRouteFor('/api/workbenches', [WORKBENCH_ROUTE])).toBeNull();
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
      routeToWorkspace(
        new Request('https://livediagram-router.liveworkspace-easing509.workers.dev/document/d1'),
        {
          app: 'livediagram',
          fetch: doFetch,
        },
      ),
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
    [
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/explorer/recent?x=1',
      '/explorer/recent?x=1',
    ],
    [
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/account/people',
      '/api/workspace/account/people',
    ],
    // Elsewhere on liveworkspace (the account pages): left for the browser to go there.
    [
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/account/teams',
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/account/teams',
    ],
    ['https://www.liveplanner.app/project/p1', 'https://www.liveplanner.app/project/p1'],
    ['/sign-in?return=%2Fexplorer', '/sign-in?return=%2Fexplorer'],
  ])('%s → %s', (location, expected) => {
    expect(locationOnApp(location, PRODUCTION_WORKSPACE_ORIGIN, ROUTES)).toBe(expected);
  });

  it('rewrites the Location of a forwarded redirect', async () => {
    const doFetch = upstream(
      new Response(null, {
        status: 307,
        headers: {
          Location:
            'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/explorer/recent',
        },
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
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/sign-in?client_id=c&sig=s',
      '/sign-in',
    ],
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/sign-up?client_id=c&prompt=create&sig=s',
      '/sign-up',
    ],
    ['https://livediagram-router.liveworkspace-easing509.workers.dev/consent?sig=s', '/consent'],
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/auth/sign-in/email-otp',
      '/api/workspace/auth',
    ],
    // The app's own sign-in hand-off page, and its own auth routes, stay the app's.
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/sign-in/?redirect_url=%2Fexplorer',
      null,
    ],
    ['https://livediagram-router.liveworkspace-easing509.workers.dev/sign-in', null],
    ['https://livediagram-router.liveworkspace-easing509.workers.dev/sign-in.txt', null],
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/auth/callback?code=c&state=s',
      null,
    ],
    ['https://livediagram-router.liveworkspace-easing509.workers.dev/get-started/', null],
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/_liveworkspace/_next/static/chunks/a.js',
      '/_liveworkspace',
    ],
    [
      'https://livediagram-router.liveworkspace-easing509.workers.dev/_next/static/chunks/a.js',
      null,
    ],
  ])('%s', (address, prefix) => {
    const url = new URL(address);
    expect(workspaceRouteFor(url.pathname, routes, url)?.prefix ?? null).toBe(prefix);
  });

  it("sends liveworkspace only the sign-in's own cookies, under their own names", async () => {
    const doFetch = upstream(new Response('{}'));
    await routeToWorkspace(
      new Request(
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/auth/get-session',
        {
          headers: {
            Cookie:
              'ld_refresh=secret; lw_flow.__Secure-better-auth.session_token=tok.sig; ld_signed_in=1',
          },
        },
      ),
      { app: 'livediagram', fetch: doFetch },
    );
    const sent = doFetch.mock.calls[0]![0] as Request;
    expect(sent.url).toBe(
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/auth/get-session',
    );
    expect(sent.headers.get('Cookie')).toBe('__Secure-better-auth.session_token=tok.sig');

    await routeToWorkspace(
      new Request(
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/auth/get-session',
        {
          headers: { Cookie: 'ld_refresh=secret' },
        },
      ),
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
      new Request(
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/auth/sign-in/email-otp',
        {
          method: 'POST',
        },
      ),
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
      new Request(
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/auth/sign-in/email-otp',
        {
          headers: { 'CF-Connecting-IP': '203.0.113.9' },
        },
      ),
      { app: 'livediagram', fetch: doFetch },
    );
    expect((doFetch.mock.calls[0]![0] as Request).headers.get(WORKSPACE_CLIENT_IP_HEADER)).toBe(
      '203.0.113.9',
    );
    await routeToWorkspace(
      new Request(
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/auth/sign-in/email-otp',
        {
          headers: { [WORKSPACE_CLIENT_IP_HEADER]: '198.51.100.1' },
        },
      ),
      { app: 'livediagram', fetch: doFetch },
    );
    expect((doFetch.mock.calls[1]![0] as Request).headers.has(WORKSPACE_CLIENT_IP_HEADER)).toBe(
      false,
    );
  });

  it("passes the pages' cookies neither way", async () => {
    const doFetch = upstream(new Response('<html>', { headers: { 'Set-Cookie': 'x=1; Path=/' } }));
    const response = await routeToWorkspace(
      new Request('https://livediagram-router.liveworkspace-easing509.workers.dev/sign-in?sig=s', {
        headers: { Cookie: 'ld_refresh=r' },
      }),
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
      locationOnApp(
        'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/sign-up?sig=s',
        PRODUCTION_WORKSPACE_ORIGIN,
        routes,
      ),
    ).toBe('/sign-up?sig=s');
    expect(
      locationOnApp('https://accounts.google.com/o/oauth2', PRODUCTION_WORKSPACE_ORIGIN, routes),
    ).toBe('https://accounts.google.com/o/oauth2');
  });
});

describe('forwardToIndex', () => {
  it("sends the request to the index without the site's cookies, naming the visitor's address", async () => {
    const seen: Request[] = [];
    const doFetch = (async (input: RequestInfo | URL) => {
      seen.push(input as Request);
      return new Response('ok');
    }) as typeof fetch;
    const request = new Request(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/index/items?app=livediagram',
      {
        method: 'POST',
        body: '{}',
        headers: {
          Authorization: 'Bearer t',
          Cookie: 'session=1',
          'CF-Connecting-IP': '198.51.100.7',
        },
      },
    );
    await forwardToIndex(request, new URL(request.url), PRODUCTION_INDEX_ORIGIN, doFetch);
    expect(seen[0]!.url).toBe(
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/index/items?app=livediagram',
    );
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer t');
    expect(seen[0]!.headers.has('Cookie')).toBe(false);
    expect(seen[0]!.headers.get(WORKSPACE_CLIENT_IP_HEADER)).toBe('198.51.100.7');
    // A caller's own claim to an address never goes along.
    const spoofed = new Request(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/index/items',
      {
        headers: { [WORKSPACE_CLIENT_IP_HEADER]: '203.0.113.1' },
      },
    );
    await forwardToIndex(spoofed, new URL(spoofed.url), 'https://index.test', doFetch);
    expect(seen[1]!.headers.has(WORKSPACE_CLIENT_IP_HEADER)).toBe(false);
  });

  it('refuses to forward to its own site, rather than loop', async () => {
    const doFetch = upstream(new Response('ok'));
    const request = new Request(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/index/items',
    );
    const res = await forwardToIndex(
      request,
      new URL(request.url),
      'https://livediagram-router.liveworkspace-easing509.workers.dev',
      doFetch,
    );
    expect(res.status).toBe(508);
    expect(doFetch).not.toHaveBeenCalled();
  });
});

// Where each router finds liveworkspace.app, per environment: staging's routers must name staging's site, or a
// staging page under /explorer would load `/_liveworkspace` chunks from production's build, whose hashes differ.
describe('each router names its environment’s liveworkspace.app', () => {
  const varsOf = (toml: string, section: string): string => {
    const start = toml.indexOf(`[${section}]`);
    if (start < 0) return '';
    const rest = toml.slice(start + section.length + 2);
    const next = rest.search(/^\[/m);
    return next < 0 ? rest : rest.slice(0, next);
  };
  const originIn = (vars: string) => /^WORKSPACE_ORIGIN = "([^"]*)"/m.exec(vars)?.[1];

  it.each(APP_NAMES)(
    '%s: local dev the local site, staging the staging site, production the default',
    (app) => {
      const toml = readFileSync(
        new URL(`../../../${app}/apps/router/wrangler.toml`, import.meta.url),
        'utf8',
      );
      expect(originIn(varsOf(toml, 'env.local.vars'))).toBe('http://localhost:3000');
      expect(originIn(varsOf(toml, 'env.staging.vars'))).toBe(
        'https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev',
      );
      // Production's top-level vars leave it unset: routeToWorkspace falls back to PRODUCTION_WORKSPACE_ORIGIN.
      expect(originIn(varsOf(toml, 'vars'))).toBeUndefined();
    },
  );
});

describe('forwardToDrive', () => {
  it('forwards /api/drive/* to the Drive origin without the site cookies', async () => {
    const seen: Request[] = [];
    const doFetch = (async (req: Request) => {
      seen.push(req);
      return new Response('ok');
    }) as unknown as typeof fetch;
    const request = new Request('https://liveplanner.app/api/drive/config?x=1', {
      headers: { Cookie: 'session=1', Authorization: 'Bearer t' },
    });
    await forwardToDrive(request, new URL(request.url), PRODUCTION_DRIVE_ORIGIN, doFetch);
    expect(seen[0]!.url).toBe(`${PRODUCTION_DRIVE_ORIGIN}/api/drive/config?x=1`);
    expect(seen[0]!.headers.get('Cookie')).toBeNull();
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer t');
  });

  it('refuses to forward to itself', async () => {
    const request = new Request('https://drive.test/api/drive/config');
    const res = await forwardToDrive(request, new URL(request.url), 'https://drive.test');
    expect(res.status).toBe(508);
  });

  it('knows its paths', () => {
    expect(isDrivePath('/api/drive')).toBe(true);
    expect(isDrivePath('/api/drive/marks')).toBe(true);
    expect(isDrivePath('/api/drivex')).toBe(false);
  });
});
