// The second half of every app's router tests (app-router-testing.ts): what the router serves of liveworkspace's
// under the app's address (previews, the Explorer, the Community page, oEmbed, the service bindings), the bare
// domain, HTTPS, and Automatically Open Explorer.

import { describe, expect, it, vi } from 'vitest';
import type {
  AppRouterFacts,
  AppRouterHarness,
  AppRouterTestEnv as Env,
} from './app-router-testing';
import { recordingBindings, ROUTER_BINDING_CASES } from './router-bindings-testing';
import { APP_BARE_HOSTS } from './workspace-proxy';

export function describeWorkspaceRoutes(facts: AppRouterFacts, harness: AppRouterHarness): void {
  const { router, app, pageSegment, signedInCookie } = facts;
  const { makeEnv, dispatch, site } = harness;
  const bare = `${app}.app`;

  describe("liveworkspace's previews under this address (liveworkspace/docs/specs/006-media/previews.md)", () => {
    it("sends every item's preview and a link's image and card to the previews service, never the api", async () => {
      const fetchMock = vi.fn((_req: Request) => Promise.resolve(new Response('ok')));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env, api } = makeEnv();
        await router.fetch(new Request(`${site}/api/previews/items/d1?v=5`), env);
        await router.fetch(new Request(`${site}/api/share/ABC/image.png`), {
          ...env,
          PREVIEWS_ORIGIN: 'http://127.0.0.1:8792',
        });
        expect(fetchMock.mock.calls.map(([r]) => r.url)).toEqual([
          'https://www.liveworkspace.app/api/previews/items/d1?v=5',
          'http://127.0.0.1:8792/api/previews/share/ABC/image.png',
        ]);
        // What a link opens stays the api's.
        await router.fetch(new Request(`${site}/api/share/ABC`), env);
        expect(api.urls).toEqual([`${site}/api/share/ABC`]);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("liveworkspace's Explorer under this address (@liveworkspace/sites/workspace-proxy)", () => {
    const page = () =>
      new Response('<!doctype html><title>Explorer</title>', {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=0',
        },
      });

    it('serves every /explorer address from liveworkspace.app, path and query kept, the page never cached', async () => {
      const fetchMock = vi.fn((_req: Request) => Promise.resolve(page()));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env, live, marketing } = makeEnv();
        for (const path of [
          '/explorer',
          '/explorer/recent',
          '/explorer/team?id=t1&folder=f2',
          '/explorer/profile',
          '/explorer?settings=notifications',
          '/explorer/offline',
        ]) {
          const res = await router.fetch(new Request(`${site}${path}#ignored`), env);
          expect(res.status).toBe(200);
          expect(res.headers.get('Cache-Control')).toBe('no-store');
          expect(fetchMock.mock.lastCall![0].url).toBe(`https://www.liveworkspace.app${path}`);
        }
        expect(live.urls).toEqual([]);
        expect(marketing.urls).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("goes to the origin named (local dev, staging), with the page's payloads and the account reads", async () => {
      const fetchMock = vi.fn((_req: Request) => Promise.resolve(new Response('ok')));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env, api } = makeEnv();
        const local = { ...env, WORKSPACE_ORIGIN: 'http://localhost:3000' };
        await router.fetch(new Request(`${site}/explorer/recent.txt?_rsc=x`), local);
        expect(fetchMock.mock.calls[0]![0].url).toBe(
          'http://localhost:3000/explorer/recent.txt?_rsc=x',
        );
        await router.fetch(
          new Request(`${site}/api/workspace/account/people?ids=u1`, {
            headers: { Authorization: 'Bearer t', Cookie: 'refresh=secret' },
          }),
          local,
        );
        const sent = fetchMock.mock.calls[1]![0];
        expect(sent.url).toBe('http://localhost:3000/api/account/people?ids=u1');
        expect(sent.headers.get('Authorization')).toBe('Bearer t');
        expect(sent.headers.get('Cookie')).toBeNull();
        expect(api.urls).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("leaves the app's own assets, pages and api where they were", async () => {
      const fetchMock = vi.fn((_req: Request) => Promise.resolve(new Response('ok')));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env, live, marketing, api } = makeEnv();
        await dispatch('/live/_next/static/chunk.js', env);
        await dispatch('/_next/static/chunk.js', env);
        await dispatch('/explorers', env);
        await dispatch('/api/account', env);
        await dispatch('/new', env);
        expect(live.urls).toEqual([`${site}/_next/static/chunk.js`, `${site}/new`]);
        expect(marketing.urls).toEqual([`${site}/_next/static/chunk.js`, `${site}/explorers`]);
        expect(api.urls).toEqual([`${site}/api/account`]);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('keeps a redirect on this address', async () => {
      const fetchMock = vi.fn((_req: Request) =>
        Promise.resolve(
          new Response(null, {
            status: 307,
            headers: { Location: 'https://www.liveworkspace.app/explorer/recent' },
          }),
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      try {
        const res = await dispatch('/explorer/recent/', makeEnv().env);
        expect(res.status).toBe(307);
        expect(res.headers.get('Location')).toBe('/explorer/recent');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('never loops: an origin naming this router, or a request already forwarded, is refused', async () => {
      const fetchMock = vi.fn((_req: Request) => Promise.resolve(page()));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env } = makeEnv();
        const self = await router.fetch(new Request(`${site}/explorer`), {
          ...env,
          WORKSPACE_ORIGIN: `${site}`,
        });
        expect(self.status).toBe(508);
        const again = await router.fetch(
          new Request(`${site}/explorer`, {
            headers: { 'X-Liveworkspace-Proxy': app },
          }),
          env,
        );
        expect(again.status).toBe(508);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  // The bare domain's pages live on www. (docs/specs/016-platform/router-app.md "The bare domain").
  describe('the bare domain', () => {
    const REDIRECTS = new Set([301, 302, 303, 307, 308]);
    const on = (host: string, path: string, env: Env, init?: RequestInit) =>
      router.fetch(new Request(`https://${host}${path}`, init), env);

    it('is among the platform’s bare app domains', () => {
      expect(APP_BARE_HOSTS.has(bare)).toBe(true);
    });

    it('sends every page to www. in one cacheable 301, path and query kept', async () => {
      const { env, marketing, api } = makeEnv();
      for (const path of [
        '/',
        '/new',
        '/new?template=kanban',
        '/s/abc123?view=present',
        '/join/t0k3n?team=1',
        '/sign-in?client_id=a&sig=b',
        '/explorer/recent?x=1',
        '/help/user-interface/',
        '/live/_next/static/chunks/app.js',
        '/pricing',
      ]) {
        for (const method of ['GET', 'HEAD']) {
          const res = await on(bare, path, env, { method });
          expect(res.status, path).toBe(301);
          expect(res.headers.get('Location'), path).toBe(`${site}${path}`);
          expect(res.headers.get('Cache-Control'), path).toBe('public, max-age=86400');
        }
      }
      // Answered before anything is fetched.
      expect(marketing.urls).toEqual([]);
      expect(api.urls).toEqual([]);
    });

    it('is one hop: where it lands never redirects again', async () => {
      const { env } = makeEnv();
      for (const path of [
        '/',
        '/new',
        '/getting-started',
        '/getting-started/first-steps?x=1',
        '/tools',
        '/troubleshooting/',
        '/getting-started/',
        '/status',
        '/telemetry',
        ...(facts.oneHopPaths ?? []),
      ]) {
        const first = await on(bare, path, env);
        expect(REDIRECTS.has(first.status), path).toBe(true);
        const next = new URL(first.headers.get('Location')!);
        if (next.hostname !== `www.${bare}`) continue; // Left the site (status, telemetry): its own one hop.
        const second = await router.fetch(new Request(next), env);
        expect(REDIRECTS.has(second.status), `${path} -> ${next.href}`).toBe(false);
      }
    });

    it('leaves the api, the sign-in callback, WebSockets and other methods on the bare domain', async () => {
      const { env, api } = makeEnv();
      await on(bare, '/api/auth/callback?code=1&state=2', env);
      await on(bare, '/api/things', env, { method: 'POST', body: '{}' });
      await on(bare, '/api/things/x/ws', env, { headers: { Upgrade: 'websocket' } });
      expect(api.urls).toEqual([
        `https://${bare}/api/auth/callback?code=1&state=2`,
        `https://${bare}/api/things`,
        `https://${bare}/api/things/x/ws`,
      ]);
      for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
        expect((await on(bare, '/new', env, { method })).status, method).not.toBe(301);
      }
      expect((await on(bare, '/.well-known/security.txt', env)).status).not.toBe(301);
    });

    it('never redirects www., staging or the router’s own address, so it cannot loop or leave staging', async () => {
      const { env } = makeEnv();
      const staging: Env = { ...env, DEPLOY_ENV: 'staging' };
      // `wrangler dev` hands a local router its production host, so local never redirects either.
      for (const DEPLOY_ENV of ['local', 'staging']) {
        expect(REDIRECTS.has((await on(bare, '/new', { ...env, DEPLOY_ENV })).status)).toBe(false);
      }
      for (const host of [`www.${bare}`, `staging.${bare}`, `${app}-router.example.workers.dev`]) {
        for (const e of [env, staging]) {
          expect(REDIRECTS.has((await on(host, '/new', e)).status), host).toBe(false);
        }
      }
    });
  });

  describe("liveworkspace's Community page under this address (@liveworkspace/community-site/router)", () => {
    it("serves /community and its posts from liveworkspace.app, the head made this app's own", async () => {
      const urlOf = (req: Request | string) => (typeof req === 'string' ? req : req.url);
      const fetchMock = vi.fn((req: Request | string) =>
        Promise.resolve(
          new URL(urlOf(req)).pathname.startsWith('/api/community')
            ? new Response('', { status: 503 })
            : new Response('<!doctype html><title>Community</title>', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              }),
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      vi.stubGlobal(
        'HTMLRewriter',
        class {
          on() {
            return this;
          }
          transform(res: Response) {
            return res;
          }
        },
      );
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { env, marketing } = makeEnv();
        for (const path of ['/community', '/community/post?id=p1', '/community.txt?_rsc=x']) {
          const res = await dispatch(path, env);
          expect(res.status, path).toBe(200);
          if (path === '/community') expect(res.headers.get('Cache-Control')).toBe('no-store');
          const asked = fetchMock.mock.calls.map(([req]) => urlOf(req));
          expect(asked, path).toContain(`https://www.liveworkspace.app${path}`);
        }
        expect(marketing.urls).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    });

    it("answers the Community's sitemap itself, from the service, for this app's posts", async () => {
      const fetchMock = vi.fn((_req: string) =>
        Promise.resolve(Response.json({ posts: [{ id: 'p1', updatedAt: 0 }] })),
      );
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env } = makeEnv();
        const res = await dispatch('/community/sitemap.xml', env);
        expect(await res.text()).toContain(`<loc>${site}/community/post?id=p1</loc>`);
        const asked = fetchMock.mock.calls[0]![0];
        expect(asked).toBe(`https://www.liveworkspace.app/api/community/sitemap?app=${bare}`);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("the visitor's address, proved to liveworkspace", () => {
    it('sends the router secret beside it to accounts and the index, never a caller-sent copy', async () => {
      const seen: Request[] = [];
      vi.stubGlobal('fetch', (req: Request) => {
        seen.push(req);
        return Promise.resolve(new Response('ok'));
      });
      try {
        const { env } = makeEnv();
        const withSecret = { ...env, WORKSPACE_PROXY_SECRET: 'router-secret' };
        const visit = (path: string, routerEnv: Env) =>
          router.fetch(
            new Request(`${site}${path}`, {
              headers: {
                'CF-Connecting-IP': '203.0.113.7',
                'X-Liveworkspace-Client-IP': '198.51.100.1',
                'X-Liveworkspace-Proxy-Secret': 'forged',
              },
            }),
            routerEnv,
          );
        await visit('/api/index/items', withSecret);
        await visit('/api/workspace/account/me', withSecret);
        await visit('/api/index/items', env);
        expect(seen.map((r) => r.headers.get('X-Liveworkspace-Proxy-Secret'))).toEqual([
          'router-secret',
          'router-secret',
          null,
        ]);
        expect(
          seen.every((r) => r.headers.get('X-Liveworkspace-Client-IP') === '203.0.113.7'),
        ).toBe(true);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer")', () => {
    const home = (path: string, headers: Record<string, string>) =>
      new Request(`${site}${path}`, { headers });
    const on = {
      Cookie: `${signedInCookie}=1; lw_open_explorer=1`,
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Dest': 'document',
    };

    it('sends the homepage to the Explorer with the switch on, never cached, marketing never asked', async () => {
      const { env, marketing } = makeEnv();
      const res = await router.fetch(home('/', on), env);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/explorer/home');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('Vary')).toBe('Cookie');
      expect(marketing.urls).toEqual([]);
    });

    it('serves the homepage without the cookie, or signed out', async () => {
      for (const Cookie of [
        `${signedInCookie}=1`,
        'lw_open_explorer=1',
        `${signedInCookie}=0; lw_open_explorer=1`,
      ]) {
        const { env, marketing } = makeEnv();
        const res = await router.fetch(home('/', { ...on, Cookie }), env);
        expect(res.status).toBe(200);
        expect(marketing.urls).toEqual([`${site}/`]);
      }
    });

    it('leaves every other page, `/?home` and a link inside the site on the homepage', async () => {
      const { env, marketing } = makeEnv();
      await router.fetch(home('/faq', on), env);
      await router.fetch(home('/?home', on), env);
      await router.fetch(home('/', { ...on, 'Sec-Fetch-Site': 'same-origin' }), env);
      await router.fetch(home('/', { ...on, 'Sec-Fetch-Dest': 'empty' }), env);
      expect(marketing.urls).toEqual([`${site}/faq`, `${site}/?home`, `${site}/`, `${site}/`]);
    });
  });

  // Locally each downstream is an origin, and one that isn't running (a stack started without it) answers 502 through
  // @liveworkspace/sites forwardOr502, never a bare 500 "Network connection lost" (Work Tracker 850).
  describe('an unreachable origin', () => {
    it.each([
      ['marketing', '/'],
      ['the api', '/api/x'],
      ['the editor', '/live/x.js'],
      ['help', '/help/x'],
      ['the index', '/api/index/items'],
      ['the Drive mirror', '/api/drive/x'],
      ['the previews service', '/api/previews/items/x'],
    ])('answers 502 for %s', async (_, path) => {
      vi.stubGlobal('fetch', async () => {
        throw new Error('Network connection lost.');
      });
      try {
        const res = await dispatch(path, {
          DEPLOY_ENV: 'local',
          MARKETING_ORIGIN: 'http://127.0.0.1:3901',
          EDITOR_ORIGIN: 'http://127.0.0.1:3902',
          LIVE_ORIGIN: 'http://127.0.0.1:3902',
          API_ORIGIN: 'http://127.0.0.1:3906',
          HELP_ORIGIN: 'http://127.0.0.1:3904',
          INDEX_ORIGIN: 'http://127.0.0.1:3907',
          DRIVE_ORIGIN: 'http://127.0.0.1:3908',
          PREVIEWS_ORIGIN: 'http://127.0.0.1:3909',
        } as unknown as Env);
        expect(res.status).toBe(502);
        expect(await res.text()).toMatch(
          /^router: .+ at http:\/\/127\.0\.0\.1:39\d\d could not be reached$/,
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('a pasted share link\'s oEmbed (liveworkspace/docs/specs/006-media/previews.md "Pasting a share link")', () => {
    const urlOf = (input: RequestInfo | URL) =>
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const oembedFor = (code: string) =>
      new Request(
        `${site}/oembed?url=${encodeURIComponent(`${site}/${pageSegment}/shared?s=${code}`)}&format=json`,
      );

    it('answers /oembed here from the share card, a read-only iframe, never forwarding it to an app', async () => {
      const fetchMock = vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(
          urlOf(input).endsWith('/share/OPENCODE/card')
            ? Response.json({ name: 'Launch plan' })
            : Response.json({ error: 'not_found' }, { status: 404 }),
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      try {
        const { env, marketing, live, api, help } = makeEnv();
        const local = { ...env, PREVIEWS_ORIGIN: 'http://127.0.0.1:8792' };
        const res = await router.fetch(oembedFor('OPENCODE'), local);
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
        const body = (await res.json()) as { provider_name: string; title: string; html: string };
        expect(body.provider_name).toBe(app);
        expect(body.title).toBe('Launch plan');
        // Read-only whatever the link's role: an edit link pasted into a public page gives no edit rights.
        expect(body.html).toContain(`src="${site}/embed?s=OPENCODE&amp;readonly=1"`);
        expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).toEqual([
          'http://127.0.0.1:8792/api/previews/share/OPENCODE/card',
        ]);
        // A link the share card refuses (password-protected, revoked, expired or trashed) is a 404.
        expect((await router.fetch(oembedFor('GATEDCODE'), local)).status).toBe(404);
        expect([...marketing.urls, ...live.urls, ...api.urls, ...help.urls]).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  // Plain HTTP goes to HTTPS (docs/specs/016-platform/router-app.md "Only over HTTPS").
  describe('only over HTTPS', () => {
    const REDIRECTS = new Set([301, 302, 303, 307, 308]);

    it('sends http://www. to the same path and query over https in one 301, before anything is fetched', async () => {
      const { env, marketing, live, api, help } = makeEnv();
      for (const path of ['/', '/x?y=1', '/new?template=a&b=%2F', '/api/things?id=1']) {
        for (const method of ['GET', 'HEAD']) {
          const res = await router.fetch(new Request(`http://www.${bare}${path}`, { method }), env);
          expect(res.status, path).toBe(301);
          expect(res.headers.get('Location'), path).toBe(`${site}${path}`);
        }
      }
      for (const fetcher of [marketing, live, api, help]) expect(fetcher.urls).toEqual([]);
    });

    it('keeps a POST a POST (308), and sends a ws:// upgrade to https too', async () => {
      const { env } = makeEnv();
      const post = await router.fetch(
        new Request(`http://www.${bare}/api/things`, { method: 'POST', body: '{}' }),
        env,
      );
      expect(post.status).toBe(308);
      expect(post.headers.get('Location')).toBe(`${site}/api/things`);
      const ws = await router.fetch(
        new Request(`http://www.${bare}/api/rooms/x`, {
          headers: { Upgrade: 'websocket' },
        }),
        env,
      );
      expect(ws.status).toBe(301);
    });

    it('passes https through untouched, and an http:// URL Cloudflare marks as an HTTPS visit, so it cannot loop', async () => {
      const { env } = makeEnv();
      const https = await router.fetch(new Request(`${site}/x?y=1`), env);
      expect(REDIRECTS.has(https.status)).toBe(false);
      const marked = await router.fetch(
        new Request(`http://www.${bare}/x?y=1`, {
          headers: { 'CF-Visitor': '{"scheme":"https"}' },
        }),
        env,
      );
      expect(REDIRECTS.has(marked.status)).toBe(false);
    });

    it('redirects staging too, and never a local router (wrangler dev hands it the production host)', async () => {
      const { env } = makeEnv();
      const staging = await router.fetch(new Request(`http://staging.${bare}/x`), {
        ...env,
        DEPLOY_ENV: 'staging',
      });
      expect(staging.headers.get('Location')).toBe(`https://staging.${bare}/x`);
      const local = await router.fetch(new Request(`http://www.${bare}/x`), {
        ...env,
        DEPLOY_ENV: 'local',
      });
      expect(REDIRECTS.has(local.status)).toBe(false);
    });
  });

  // liveworkspace's Workers over the router's service bindings (Work Tracker 1069): each target reaches its own binding
  // with the path the public route would see, and with no bindings (a local run, a fork) the public route instead.
  describe("liveworkspace's Workers over service bindings", () => {
    it.each(ROUTER_BINDING_CASES)('$path goes to $binding', async ({ binding, path, target }) => {
      const { bindings, calls } = recordingBindings();
      vi.stubGlobal('fetch', () => Promise.reject(new Error('the public route was used')));
      try {
        await dispatch(path, { ...makeEnv().env, ...bindings });
      } finally {
        vi.unstubAllGlobals();
      }
      expect(calls[binding].map((url) => `${url.host}${url.pathname}`)).toEqual([
        `www.liveworkspace.app${target}`,
      ]);
      expect(Object.values(calls).flat()).toHaveLength(1);
    });

    it.each(ROUTER_BINDING_CASES)(
      '$path takes the public route without one',
      async ({ path, target }) => {
        const seen: URL[] = [];
        vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
          seen.push(new URL(input instanceof Request ? input.url : new Request(input, init).url));
          return Promise.resolve(Response.json({ posts: [] }));
        });
        try {
          await dispatch(path, makeEnv().env);
        } finally {
          vi.unstubAllGlobals();
        }
        expect(seen.map((url) => `${url.host}${url.pathname}`)).toEqual([
          `www.liveworkspace.app${target}`,
        ]);
      },
    );
  });
}
