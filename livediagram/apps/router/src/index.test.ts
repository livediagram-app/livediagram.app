import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import router, { type Env } from './index';

// Dispatch tests for the router (docs/specs/016-platform/router-app.md): every production request
// flows through this table, and a mistake here is a product-wide
// outage, so the path -> (worker, strip) mapping is pinned against
// mock service bindings. The final describe is a cross-app drift
// guard: a NEW top-level live route that never gets a router entry
// silently falls through to marketing's 404, which nothing else
// would catch until production.

function mockFetcher() {
  const urls: string[] = [];
  const fetcher = {
    fetch: (req: Request) => {
      urls.push(req.url);
      return Promise.resolve(new Response('ok'));
    },
  } as unknown as Fetcher;
  return { fetcher, urls };
}

function makeEnv() {
  const marketing = mockFetcher();
  const live = mockFetcher();
  const api = mockFetcher();
  const help = mockFetcher();
  const community = mockFetcher();
  const env: Env = {
    MARKETING: marketing.fetcher,
    EDITOR: live.fetcher,
    API: api.fetcher,
    HELP: help.fetcher,
    COMMUNITY: community.fetcher,
  };
  return { env, marketing, live, api, help, community };
}

const dispatch = (path: string, env: Env) =>
  router.fetch(
    new Request(`https://livediagram-router.liveworkspace-easing509.workers.dev${path}`),
    env,
  );

describe('production dispatch (service bindings)', () => {
  it('forwards /api/* to the api worker with the prefix KEPT', async () => {
    const { env, api } = makeEnv();
    await dispatch('/api/documents/abc', env);
    expect(api.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/documents/abc',
    ]);
  });

  it("sends /api/index/* to the index, not the api, without this site's cookies", async () => {
    const { env, api } = makeEnv();
    const seen: Request[] = [];
    vi.stubGlobal('fetch', (req: Request) => {
      seen.push(req);
      return Promise.resolve(new Response('index'));
    });
    try {
      const res = await router.fetch(
        new Request(
          'https://livediagram-router.liveworkspace-easing509.workers.dev/api/index/items?app=livediagram',
          {
            headers: { Cookie: 'ld_signed_in=1', Authorization: 'Bearer t' },
          },
        ),
        { ...env, INDEX_ORIGIN: 'https://index.test' },
      );
      expect(await res.text()).toBe('index');
      expect(seen[0]!.url).toBe('https://index.test/api/index/items?app=livediagram');
      expect(seen[0]!.headers.get('Cookie')).toBeNull();
      expect(seen[0]!.headers.get('Authorization')).toBe('Bearer t');
      expect(api.urls).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('forwards /api/drive/* to the Drive mirror, Authorization kept, cookies dropped', async () => {
    const fetchMock = vi.fn((_req: Request) => Promise.resolve(new Response('ok')));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { env, api } = makeEnv();
      await router.fetch(
        new Request(
          'https://livediagram-router.liveworkspace-easing509.workers.dev/api/drive/marks',
          {
            headers: { Authorization: 'Bearer t', Cookie: 'a=b' },
          },
        ),
        { ...env, DRIVE_ORIGIN: 'http://127.0.0.1:3011' },
      );
      const req = fetchMock.mock.calls[0]![0];
      expect(req.url).toBe('http://127.0.0.1:3011/api/drive/marks');
      expect(req.headers.get('Authorization')).toBe('Bearer t');
      expect(req.headers.get('Cookie')).toBeNull();
      // Production's when no origin is named, and never the api worker.
      await dispatch('/api/drive/config', env);
      expect(fetchMock.mock.calls[1]![0].url).toBe(
        'https://liveworkspace.app/api/drive/config',
      );
      expect(api.urls).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('strips /live off the asset-prefix requests for the editor worker', async () => {
    const { env, live } = makeEnv();
    await dispatch('/live/_next/static/chunk.js', env);
    expect(live.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/_next/static/chunk.js',
    ]);
  });

  it('strips the basePath for help, keeping the query', async () => {
    const { env, help } = makeEnv();
    await dispatch('/help/canvas/themes/', env);
    expect(help.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/canvas/themes/',
    ]);
  });

  it("puts the prefix back on a stripped app's own redirect, keeping its query", async () => {
    const { env } = makeEnv();
    const redirecting = (location: string) =>
      ({
        fetch: () =>
          Promise.resolve(new Response(null, { status: 307, headers: { Location: location } })),
      }) as unknown as Fetcher;
    const res = await dispatch('/help/explorer/folders', {
      ...env,
      HELP: redirecting('/explorer/folders/'),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('/help/explorer/folders/');
    const post = await dispatch('/community/post?id=X', {
      ...env,
      COMMUNITY: redirecting('/post/?id=X'),
    });
    expect(post.headers.get('Location')).toBe('/community/post/?id=X');
    // An absolute one, or one already under the prefix, is left as it is.
    const abs = await dispatch('/help/x', { ...env, HELP: redirecting('https://elsewhere.test/') });
    expect(abs.headers.get('Location')).toBe('https://elsewhere.test/');
    const kept = await dispatch('/help/x', { ...env, HELP: redirecting('/help/y/') });
    expect(kept.headers.get('Location')).toBe('/help/y/');
  });

  it('strips the basePath for Community (docs/specs/025-community/community.md)', async () => {
    const { env, community, marketing } = makeEnv();
    await dispatch('/community/post/?id=ABCDEFGH23', env);
    expect(community.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/post/?id=ABCDEFGH23',
    ]);
    await dispatch('/community', env);
    expect(community.urls[1]).toBe(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/',
    );
    expect(marketing.urls).toEqual([]);
  });

  it('a bare stripped prefix forwards as the root path', async () => {
    const { env, help } = makeEnv();
    await dispatch('/help', env);
    expect(help.urls).toEqual(['https://livediagram-router.liveworkspace-easing509.workers.dev/']);
  });

  // docs/specs/017-telemetry/telemetry.md: the dashboard is liveworkspace's, filtered to this app.
  it('sends /telemetry and everything under it to the liveworkspace dashboard', async () => {
    const { env, marketing } = makeEnv();
    for (const path of ['/telemetry', '/telemetry/', '/telemetry/_next/x.js?v=1']) {
      const res = await dispatch(path, env);
      expect(res.status, path).toBe(301);
      expect(res.headers.get('Location'), path).toBe(
        'https://liveworkspace.app/telemetry?app=livediagram.app',
      );
    }
    expect(marketing.urls).toEqual([]);
    const staging = await dispatch('/telemetry', { ...env, DEPLOY_ENV: 'staging' });
    expect(staging.headers.get('Location')).toBe(
      'https://staging.liveworkspace.app/telemetry?app=livediagram.app',
    );
  });

  it('forwards the clean live page routes UNstripped', async () => {
    const { env, live } = makeEnv();
    await dispatch('/document/abc123', env);
    await dispatch('/new?blank=1', env);
    expect(live.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/document/abc123',
      'https://livediagram-router.liveworkspace-easing509.workers.dev/new?blank=1',
    ]);
  });

  it("routes the editor app's root-served icon to the editor worker", async () => {
    const { env, live } = makeEnv();
    await dispatch('/icon.svg', env);
    expect(live.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/icon.svg',
    ]);
  });

  it('serves the licences page and its texts from marketing', async () => {
    // docs/specs/002-project-scope/third-party-licences.md
    const { env, marketing } = makeEnv();
    await dispatch('/licences', env);
    await dispatch('/licences/texts/0123456789abcdef.txt', env);
    expect(marketing.urls).toEqual([
      'https://livediagram-router.liveworkspace-easing509.workers.dev/licences',
      'https://livediagram-router.liveworkspace-easing509.workers.dev/licences/texts/0123456789abcdef.txt',
    ]);
  });

  it('everything else lands on marketing', async () => {
    const { env, marketing, live } = makeEnv();
    await dispatch('/', env);
    await dispatch('/faq', env);
    await dispatch('/alternatives/xmind', env);
    expect(marketing.urls).toHaveLength(3);
    expect(live.urls).toHaveLength(0);
  });
});

describe('local-dev dispatch (origin proxy)', () => {
  it('swaps the origin and keeps the path UNstripped', async () => {
    const fetchMock = vi.fn((_req: Request) => Promise.resolve(new Response('ok')));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await dispatch('/help/data', { HELP_ORIGIN: 'http://localhost:3104' });
      const req = fetchMock.mock.calls[0]![0];
      // Dev servers serve their own basePath, so no strip on this path.
      expect(req.url).toBe('http://localhost:3104/help/data');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('503s with a pointer at the fix when neither binding nor origin exists', async () => {
    const res = await dispatch('/new', {});
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('wrangler dev --env local');
  });
});

describe('live route drift guard', () => {
  it('routes every top-level apps/editor/app segment to the editor worker', async () => {
    // `.href` rather than the URL object: this worker's tsconfig loads BOTH
    // @cloudflare/workers-types and node, and each declares a global `URL`.
    // `fileURLToPath` wants Node's, `new URL(...)` resolves to the Workers
    // one, and from @types/node 26 the two are different enough that the call
    // no longer typechecks. A string is the one argument both agree on.
    const liveApp = fileURLToPath(new URL('../../editor/app', import.meta.url).href);
    const segments = readdirSync(liveApp).filter((entry) =>
      statSync(`${liveApp}/${entry}`).isDirectory(),
    );
    expect(segments.length).toBeGreaterThan(5); // the read is looking at the right place
    const missed: string[] = [];
    for (const segment of segments) {
      const { env, live } = makeEnv();
      await dispatch(`/${segment}/x`, env);
      if (live.urls.length === 0) missed.push(segment);
    }
    // A segment listed here 404s on marketing in production: add it to
    // LIVE_ROUTE_SEGMENTS in packages/api-schema/src/page-views.ts.
    expect(missed).toEqual([]);
  });
});

describe('bare help-article paths', () => {
  it('redirects a help path that lost its /help prefix', async () => {
    const { env, marketing } = makeEnv();
    const res = await dispatch('/privacy-and-security/data-privacy/', env);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/help/privacy-and-security/data-privacy/',
    );
    // Never reached marketing's 404, which is what it used to do.
    expect(marketing.urls).toEqual([]);
  });

  it('leaves marketing and live routes alone', async () => {
    for (const path of [
      '/',
      '/faq',
      '/alternatives',
      '/privacy',
      '/terms',
      '/security',
      '/.well-known/security.txt',
      '/features',
    ]) {
      const { env, marketing } = makeEnv();
      const res = await dispatch(path, env);
      expect(res.status, path).toBe(200);
      expect(marketing.urls.length, path).toBe(1);
    }
    const { env, live } = makeEnv();
    await dispatch('/new', env);
    expect(live.urls.length).toBe(1);
  });

  it("lists exactly the editor's route segments in the spec's live page routes row", async () => {
    // The spec's table is prose, so it kept `/drive/*` for weeks after the old Drive mirror's pages left the
    // editor. Pin its row to the set the router actually routes by. `explorer` has its own row (liveworkspace's).
    const { LIVE_ROUTE_SEGMENTS } = await import('@livediagram/api-schema');
    const spec = readFileSync(
      fileURLToPath(
        new URL('../../../docs/specs/016-platform/router-app.md', import.meta.url).href,
      ),
      'utf8',
    );
    const row = spec.split('\n').find((line) => line.startsWith('| live page routes:'));
    expect(row).toBeDefined();
    const listed = [...row!.matchAll(/`\/([a-z-]+)(?:\/\*)?`/g)].map((m) => m[1]!);
    const routed = [...LIVE_ROUTE_SEGMENTS].filter((segment) => segment !== 'explorer');
    expect(listed.filter((s) => s !== 'icon.svg').toSorted()).toEqual(routed.toSorted());
  });

  it('covers every help category the registry declares', async () => {
    // The list in index.ts is hand-kept; this is what stops it drifting when
    // the help centre grows a category. `explorer` is the one exclusion: the
    // editor app owns that segment.
    const { categories } = await import('@livediagram/help-registry');
    expect(categories.length).toBeGreaterThan(15);
    const missed: string[] = [];
    for (const category of categories) {
      if (category.slug === 'explorer') continue;
      const { env } = makeEnv();
      const res = await dispatch(`/${category.slug}/an-article/`, env);
      if (res.status !== 308) missed.push(category.slug);
    }
    expect(missed).toEqual([]);
  });
});

// The staging environment's noindex header (docs/specs/016-platform/staging-environment.md). Staging is public on
// purpose, so this header is the only thing keeping a second copy of every
// marketing and help page out of search results — and it has to reach every
// app on the hostname without touching any of their builds.
describe('staging noindex header', () => {
  const staging = (base: Env): Env => ({ ...base, DEPLOY_ENV: 'staging' });

  it('marks a marketing response noindex on staging', async () => {
    const { env } = makeEnv();
    const res = await dispatch('/faq', staging(env));
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('marks the api and the editor too, not just the indexable pages', async () => {
    for (const path of ['/api/documents/abc', '/document/xyz', '/help/canvas/shadows/']) {
      const { env } = makeEnv();
      const res = await dispatch(path, staging(env));
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    }
  });

  it('marks the 308 redirect for a prefix-less help article', async () => {
    const { env } = makeEnv();
    const res = await dispatch('/canvas/shadows/', staging(env));
    expect(res.status).toBe(308);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('leaves production untouched', async () => {
    const { env } = makeEnv();
    const res = await dispatch('/faq', env);
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('keeps the response body and status intact', async () => {
    const { env } = makeEnv();
    const res = await dispatch('/faq', staging(env));
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('ok');
  });

  it('passes a 101 WebSocket upgrade through UNTOUCHED', async () => {
    // A Response carrying a `webSocket` cannot be reconstructed: wrapping it
    // to add a header drops the socket and takes realtime collab down on
    // staging only, on the one path a smoke test is least likely to open.
    const socket = { accept: () => {} } as unknown as WebSocket;
    const upgrade = { status: 101, webSocket: socket } as unknown as Response;
    const env: Env = {
      ...makeEnv().env,
      API: { fetch: () => Promise.resolve(upgrade) } as unknown as Fetcher,
      DEPLOY_ENV: 'staging',
    };
    const res = await dispatch('/api/documents/abc/ws', env);
    expect(res).toBe(upgrade);
    expect(res.webSocket).toBe(socket);
  });
});

// docs/specs/016-platform/stale-builds.md "Caching rules": one policy for every site, at the router.
describe('the caching rules', () => {
  const answering = (body: string, init: ResponseInit) =>
    ({ fetch: () => Promise.resolve(new Response(body, init)) }) as unknown as Fetcher;

  it('keeps every site’s pages out of the cache and makes their build assets immutable', async () => {
    const html = { headers: { 'Content-Type': 'text/html' } };
    const env: Env = {
      MARKETING: answering('<html></html>', html),
      EDITOR: answering('<html></html>', html),
      HELP: answering('<html></html>', html),
      COMMUNITY: answering('<html></html>', html),
    };
    for (const page of ['/', '/new', '/help/canvas/', '/community']) {
      expect((await dispatch(page, env)).headers.get('Cache-Control'), page).toBe('no-store');
    }
    const assets: Env = {
      EDITOR: answering('x', { headers: { 'Content-Type': 'text/javascript' } }),
    };
    expect(
      (await dispatch('/live/_next/static/chunks/a.js', assets)).headers.get('Cache-Control'),
    ).toBe('public, max-age=31536000, immutable');
  });

  it('locally passes next dev’s own chunk caching, so a reload runs the edited code', async () => {
    // `next dev` keeps a chunk's name while its content changes, and marks it no-cache for that.
    const devChunk = answering('x', {
      headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache, must-revalidate' },
    });
    const local: Env = { DEPLOY_ENV: 'local', EDITOR: devChunk };
    expect(
      (await dispatch('/live/_next/static/chunks/a.js', local)).headers.get('Cache-Control'),
    ).toBe('no-cache, must-revalidate');
    // Pages stay out of the cache locally too.
    const page: Env = {
      DEPLOY_ENV: 'local',
      EDITOR: answering('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
    };
    expect((await dispatch('/new', page)).headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers a missing build asset with plain text, not the HTML 404 page', async () => {
    const env: Env = {
      EDITOR: answering('<html>404</html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      }),
    };
    const res = await dispatch('/live/_next/static/css/old.css', env);
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });

  it('leaves the api’s responses as the api sets them', async () => {
    const env: Env = {
      API: answering('<html>docs</html>', {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=60' },
      }),
    };
    expect((await dispatch('/api/docs', env)).headers.get('Cache-Control')).toBe(
      'public, max-age=60',
    );
  });
});

describe("liveworkspace's previews under this address (liveworkspace/docs/previews.md)", () => {
  it("sends every item's preview and a link's image and card to the previews service, never the api", async () => {
    const fetchMock = vi.fn((_req: Request) => Promise.resolve(new Response('ok')));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { env, api } = makeEnv();
      await router.fetch(
        new Request(
          'https://livediagram-router.liveworkspace-easing509.workers.dev/api/previews/items/d1?v=5',
        ),
        env,
      );
      await router.fetch(
        new Request(
          'https://livediagram-router.liveworkspace-easing509.workers.dev/api/share/ABC/image.png',
        ),
        {
          ...env,
          PREVIEWS_ORIGIN: 'http://127.0.0.1:8792',
        },
      );
      expect(fetchMock.mock.calls.map(([r]) => r.url)).toEqual([
        'https://liveworkspace.app/api/previews/items/d1?v=5',
        'http://127.0.0.1:8792/api/previews/share/ABC/image.png',
      ]);
      // What a link opens stays the api's.
      await router.fetch(
        new Request('https://livediagram-router.liveworkspace-easing509.workers.dev/api/share/ABC'),
        env,
      );
      expect(api.urls).toEqual([
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/share/ABC',
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("liveworkspace's Explorer under this address (@liveworkspace/sites/workspace-proxy)", () => {
  const page = () =>
    new Response('<!doctype html><title>Explorer</title>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0' },
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
        const res = await router.fetch(
          new Request(
            `https://livediagram-router.liveworkspace-easing509.workers.dev${path}#ignored`,
          ),
          env,
        );
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(fetchMock.mock.lastCall![0].url).toBe(
          `https://liveworkspace.app${path}`,
        );
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
      await router.fetch(
        new Request(
          'https://livediagram-router.liveworkspace-easing509.workers.dev/explorer/recent.txt?_rsc=x',
        ),
        local,
      );
      expect(fetchMock.mock.calls[0]![0].url).toBe(
        'http://localhost:3000/explorer/recent.txt?_rsc=x',
      );
      await router.fetch(
        new Request(
          'https://livediagram-router.liveworkspace-easing509.workers.dev/api/workspace/account/people?ids=u1',
          {
            headers: { Authorization: 'Bearer t', Cookie: 'refresh=secret' },
          },
        ),
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
      expect(live.urls).toEqual([
        'https://livediagram-router.liveworkspace-easing509.workers.dev/_next/static/chunk.js',
        'https://livediagram-router.liveworkspace-easing509.workers.dev/new',
      ]);
      expect(marketing.urls).toEqual([
        'https://livediagram-router.liveworkspace-easing509.workers.dev/_next/static/chunk.js',
        'https://livediagram-router.liveworkspace-easing509.workers.dev/explorers',
      ]);
      expect(api.urls).toEqual([
        'https://livediagram-router.liveworkspace-easing509.workers.dev/api/account',
      ]);
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
          headers: {
            Location:
              'https://liveworkspace.app/explorer/recent',
          },
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
      const self = await router.fetch(
        new Request('https://livediagram-router.liveworkspace-easing509.workers.dev/explorer'),
        {
          ...env,
          WORKSPACE_ORIGIN: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
        },
      );
      expect(self.status).toBe(508);
      const again = await router.fetch(
        new Request('https://livediagram-router.liveworkspace-easing509.workers.dev/explorer', {
          headers: { 'X-Liveworkspace-Proxy': 'livediagram' },
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
