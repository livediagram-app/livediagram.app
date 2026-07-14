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
    const liveApp = fileURLToPath(new URL('../../live/app', import.meta.url));
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
    // LIVE_ROUTE_SEGMENTS in apps/router/src/index.ts.
    expect(missed).toEqual([]);
  });
});
