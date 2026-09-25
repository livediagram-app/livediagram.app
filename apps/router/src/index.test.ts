import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import router, { type Env } from './index';

// Dispatch tests for the router (spec/08): every production request
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
  const env: Env = {
    MARKETING: marketing.fetcher,
    LIVE: live.fetcher,
    API: api.fetcher,
    TELEMETRY: telemetry.fetcher,
    HELP: help.fetcher,
  };
  return { env, marketing, live, api, telemetry, help };
}

const dispatch = (path: string, env: Env) =>
  router.fetch(new Request(`https://livediagram.app${path}`), env);

describe('production dispatch (service bindings)', () => {
  it('forwards /api/* to the api worker with the prefix KEPT', async () => {
    const { env, api } = makeEnv();
    await dispatch('/api/diagrams/abc', env);
    expect(api.urls).toEqual(['https://livediagram.app/api/diagrams/abc']);
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

  it('a bare stripped prefix forwards as the root path', async () => {
    const { env, telemetry } = makeEnv();
    await dispatch('/telemetry', env);
    expect(telemetry.urls).toEqual(['https://livediagram.app/']);
  });

  it('forwards the clean live page routes UNstripped', async () => {
    const { env, live } = makeEnv();
    await dispatch('/diagram/abc123', env);
    await dispatch('/new?blank=1', env);
    expect(live.urls).toEqual([
      'https://livediagram.app/diagram/abc123',
      'https://livediagram.app/new?blank=1',
    ]);
  });

  it("routes the live app's root-served icon to the live worker", async () => {
    const { env, live } = makeEnv();
    await dispatch('/icon.svg', env);
    expect(live.urls).toEqual(['https://livediagram.app/icon.svg']);
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

// The staging environment's noindex header (spec/140). Staging is public on
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
    for (const path of ['/api/diagrams/abc', '/diagram/xyz', '/help/canvas/shadows/']) {
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
    const res = await dispatch('/api/diagrams/abc/ws', env);
    expect(res).toBe(upgrade);
    expect(res.webSocket).toBe(socket);
  });
});
