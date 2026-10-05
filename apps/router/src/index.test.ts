import { readdirSync, statSync } from 'node:fs';
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
  const telemetry = mockFetcher();
  const help = mockFetcher();
  const community = mockFetcher();
  const env: Env = {
    MARKETING: marketing.fetcher,
    LIVE: live.fetcher,
    API: api.fetcher,
    TELEMETRY: telemetry.fetcher,
    HELP: help.fetcher,
    COMMUNITY: community.fetcher,
  };
  return { env, marketing, live, api, telemetry, help, community };
}

const dispatch = (path: string, env: Env) =>
  router.fetch(new Request(`https://livediagram.app${path}`), env);

describe('production dispatch (service bindings)', () => {
  it('forwards /api/* to the api worker with the prefix KEPT', async () => {
    const { env, api } = makeEnv();
    await dispatch('/api/documents/abc', env);
    expect(api.urls).toEqual(['https://livediagram.app/api/documents/abc']);
  });

  it('strips /live off the asset-prefix requests for the live worker', async () => {
    const { env, live } = makeEnv();
    await dispatch('/live/_next/static/chunk.js', env);
    expect(live.urls).toEqual(['https://livediagram.app/_next/static/chunk.js']);
  });

  it('strips the basePath for telemetry and help, keeping the query', async () => {
    const { env, telemetry, help } = makeEnv();
    await dispatch('/telemetry/data?window=30', env);
    expect(telemetry.urls).toEqual(['https://livediagram.app/data?window=30']);
    await dispatch('/help/canvas/themes/', env);
    expect(help.urls).toEqual(['https://livediagram.app/canvas/themes/']);
  });

  it('strips the basePath for Community (docs/specs/025-community/community.md)', async () => {
    const { env, community, marketing } = makeEnv();
    await dispatch('/community/post/?id=ABCDEFGH23', env);
    expect(community.urls).toEqual(['https://livediagram.app/post/?id=ABCDEFGH23']);
    await dispatch('/community', env);
    expect(community.urls[1]).toBe('https://livediagram.app/');
    expect(marketing.urls).toEqual([]);
  });

  it('a bare stripped prefix forwards as the root path', async () => {
    const { env, telemetry } = makeEnv();
    await dispatch('/telemetry', env);
    expect(telemetry.urls).toEqual(['https://livediagram.app/']);
  });

  it('forwards the clean live page routes UNstripped', async () => {
    const { env, live } = makeEnv();
    await dispatch('/document/abc123', env);
    await dispatch('/new?blank=1', env);
    expect(live.urls).toEqual([
      'https://livediagram.app/document/abc123',
      'https://livediagram.app/new?blank=1',
    ]);
  });

  it("routes the live app's root-served icon to the live worker", async () => {
    const { env, live } = makeEnv();
    await dispatch('/icon.svg', env);
    expect(live.urls).toEqual(['https://livediagram.app/icon.svg']);
  });

  it('serves the licences page and its texts from marketing', async () => {
    // docs/specs/002-project-scope/third-party-licences.md
    const { env, marketing } = makeEnv();
    await dispatch('/licences', env);
    await dispatch('/licences/texts/0123456789abcdef.txt', env);
    expect(marketing.urls).toEqual([
      'https://livediagram.app/licences',
      'https://livediagram.app/licences/texts/0123456789abcdef.txt',
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
      await dispatch('/telemetry/data', { TELEMETRY_ORIGIN: 'http://localhost:3003' });
      const req = fetchMock.mock.calls[0]![0];
      // Dev servers serve their own basePath, so no strip on this path.
      expect(req.url).toBe('http://localhost:3003/telemetry/data');
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
  it('routes every top-level apps/live/app segment to the live worker', async () => {
    // `.href` rather than the URL object: this worker's tsconfig loads BOTH
    // @cloudflare/workers-types and node, and each declares a global `URL`.
    // `fileURLToPath` wants Node's, `new URL(...)` resolves to the Workers
    // one, and from @types/node 26 the two are different enough that the call
    // no longer typechecks. A string is the one argument both agree on.
    const liveApp = fileURLToPath(new URL('../../live/app', import.meta.url).href);
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
      'https://livediagram.app/help/privacy-and-security/data-privacy/',
    );
    // Never reached marketing's 404, which is what it used to do.
    expect(marketing.urls).toEqual([]);
  });

  it('leaves marketing and live routes alone', async () => {
    for (const path of ['/', '/faq', '/alternatives', '/privacy', '/terms', '/features']) {
      const { env, marketing } = makeEnv();
      const res = await dispatch(path, env);
      expect(res.status, path).toBe(200);
      expect(marketing.urls.length, path).toBe(1);
    }
    const { env, live } = makeEnv();
    await dispatch('/explorer/recent', env);
    expect(live.urls.length).toBe(1);
  });

  it('covers every help category the registry declares', async () => {
    // The list in index.ts is hand-kept; this is what stops it drifting when
    // the help centre grows a category. `explorer` is the one exclusion: the
    // live app owns that segment.
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
      LIVE: answering('<html></html>', html),
      HELP: answering('<html></html>', html),
      TELEMETRY: answering('<html></html>', html),
      COMMUNITY: answering('<html></html>', html),
    };
    for (const page of ['/', '/explorer/unsorted', '/help/canvas/', '/telemetry', '/community']) {
      expect((await dispatch(page, env)).headers.get('Cache-Control'), page).toBe('no-store');
    }
    const assets: Env = {
      LIVE: answering('x', { headers: { 'Content-Type': 'text/javascript' } }),
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
    const local: Env = { DEPLOY_ENV: 'local', LIVE: devChunk };
    expect(
      (await dispatch('/live/_next/static/chunks/a.js', local)).headers.get('Cache-Control'),
    ).toBe('no-cache, must-revalidate');
    // Pages stay out of the cache locally too.
    const page: Env = {
      DEPLOY_ENV: 'local',
      LIVE: answering('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
    };
    expect((await dispatch('/explorer/unsorted', page)).headers.get('Cache-Control')).toBe(
      'no-store',
    );
  });

  it('answers a missing build asset with plain text, not the HTML 404 page', async () => {
    const env: Env = {
      LIVE: answering('<html>404</html>', {
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
