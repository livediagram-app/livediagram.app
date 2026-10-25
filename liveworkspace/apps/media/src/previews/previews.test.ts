// Previews over HTTP (liveworkspace/docs/previews.md): the index's access rule, freshness by its `updatedAt`, the
// app's export door on a miss, public links asked every time, the share doors and the card, and the purge.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { Env } from '../env';
import { testDb, type TestDb } from '../test-sqlite-d1';

// The rasteriser's wasm cannot load in node: the card is a marker of the drawing it was made from.
vi.mock('./share-card-png', () => ({
  shareCardPng: vi.fn(async (svg: string) => new TextEncoder().encode(`PNG(${svg})`)),
}));

type IndexItem = {
  id: string;
  app: string;
  title: string;
  updatedAt: number;
  summary: Record<string, unknown>;
};

const item = (over: Partial<IndexItem> = {}): IndexItem => ({
  id: 'I1',
  app: 'liveplanner',
  title: 'Roadmap',
  updatedAt: 100,
  summary: {},
  ...over,
});

let db: TestDb;
// What the index answers: by item id for a person, by code for a link.
let people: Map<string, { item: IndexItem; tabId?: string | null; publicCode?: string | null }>;
let links: Map<string, { item: IndexItem; tabId: string | null; public?: boolean }>;
let indexCalls: Request[];
// What each app's export door answers, and the calls it got.
let door: (url: URL, request: Request) => Response;
let doorCalls: Request[];
const pending: Promise<unknown>[] = [];

const svg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text>${label}</text></svg>`;

beforeEach(() => {
  people = new Map();
  links = new Map();
  indexCalls = [];
  doorCalls = [];
  door = () =>
    new Response(svg('drawn'), {
      headers: { ETag: '"150"', 'Content-Type': 'image/svg+xml' },
    });
  const index = {
    fetch: async (input: string, init?: RequestInit) => {
      const request = new Request(input, init);
      indexCalls.push(request);
      const path = new URL(request.url).pathname.replace('/api/index', '');
      const [, kind, key] = path.split('/');
      if (kind === 'items') {
        const found = people.get(key!);
        const allowed = request.headers.get('Authorization') === 'Bearer person';
        return found && allowed ? Response.json(found) : Response.json({}, { status: 404 });
      }
      const link = links.get(key!);
      return link ? Response.json(link) : Response.json({}, { status: 404 });
    },
  };
  db = testDb({
    INDEX: index as unknown as Fetcher,
    INDEX_URL: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/index',
    APP_ORIGIN_LIVEPLANNER: 'https://liveplanner.test',
    APP_ORIGIN_LIVEDIAGRAM: 'https://livediagram.test',
    MEDIA_KEY_LIVEPLANNER: 'lp-key',
  } as Partial<Env>);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const request = new Request(input, init);
      doorCalls.push(request);
      return door(new URL(request.url), request);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ctx = {
  waitUntil: (p: Promise<unknown>) => void pending.push(p),
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await worker.fetch(
    new Request(`https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/previews${path}`, { headers }),
    db.env,
    ctx,
  );
  await Promise.all(pending.splice(0));
  return res;
}

const asPerson = { Authorization: 'Bearer person' };

describe('an item preview', () => {
  it('draws on a miss through the app door, then serves from the bucket while fresh', async () => {
    people.set('I1', { item: item(), tabId: null, publicCode: null });
    const first = await get('/items/I1?v=100', asPerson);
    expect(first.status).toBe(200);
    expect(first.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(first.headers.get('Cache-Control')).toBe('private, max-age=86400');
    expect(first.headers.get('Content-Security-Policy')).toContain('sandbox');
    expect(await first.text()).toBe(svg('drawn'));
    expect(doorCalls).toHaveLength(1);
    const call = doorCalls[0]!;
    expect(call.url).toBe('https://liveplanner.test/api/internal/items/I1/export?format=svg');
    expect(call.headers.get('Authorization')).toBe('Bearer lp-key');
    // Stored for max(updatedAt, the app's version), so the next read never asks the app.
    const stored = db.objects.get('previews/liveplanner/I1/full-first.svg')!;
    expect(stored.customMetadata).toEqual({ v: '150', av: '150' });

    const again = await get('/items/I1?v=100', asPerson);
    expect(await again.text()).toBe(svg('drawn'));
    expect(doorCalls).toHaveLength(1);
  });

  it('asks the index with the caller’s own credentials, and answers no access as missing', async () => {
    people.set('I1', { item: item() });
    const denied = await get('/items/I1', { Authorization: 'Bearer stranger' });
    expect(denied.status).toBe(404);
    expect(denied.headers.get('Cache-Control')).toBe('no-store');
    expect(doorCalls).toHaveLength(0);
    await get('/items/I1', { ...asPerson, 'X-Share-Code': 'CODE', 'X-Share-Password': 'pw' });
    const asked = indexCalls.at(-1)!;
    expect(asked.headers.get('Authorization')).toBe('Bearer person');
    expect(asked.headers.get('X-Share-Code')).toBe('CODE');
    expect(asked.headers.get('X-Share-Password')).toBe('pw');
  });

  it('draws again once the index says the item changed', async () => {
    people.set('I1', { item: item() });
    await get('/items/I1', asPerson);
    people.set('I1', { item: item({ updatedAt: 200 }) });
    door = () => new Response(svg('newer'), { headers: { ETag: '"200"' } });
    const res = await get('/items/I1', asPerson);
    expect(await res.text()).toBe(svg('newer'));
    expect(doorCalls).toHaveLength(2);
  });

  it('asks nothing for an item the summary says is empty, and keeps an empty answer', async () => {
    people.set('E', { item: item({ id: 'E', summary: { empty: true } }) });
    const empty = await get('/items/E', asPerson);
    expect(empty.status).toBe(404);
    expect(empty.headers.get('Cache-Control')).toBe('private, max-age=86400');
    expect(doorCalls).toHaveLength(0);

    people.set('N', { item: item({ id: 'N' }) });
    door = () => new Response(null, { status: 204, headers: { ETag: '"90"' } });
    expect((await get('/items/N', asPerson)).status).toBe(404);
    expect((await get('/items/N', asPerson)).status).toBe(404);
    // Nothing to draw is remembered until the item changes.
    expect(doorCalls).toHaveLength(1);
  });

  it('draws a link confined to one tab as that tab', async () => {
    people.set('I1', { item: item(), tabId: 'T2' });
    await get('/items/I1', asPerson);
    expect(new URL(doorCalls[0]!.url).searchParams.get('tab')).toBe('T2');
    expect(db.objects.has('previews/liveplanner/I1/full-T2.svg')).toBe(true);
  });

  it('serves a stale picture when the app cannot be reached, and 503 with none', async () => {
    people.set('I1', { item: item() });
    await get('/items/I1', asPerson);
    people.set('I1', { item: item({ updatedAt: 999 }) });
    door = () => new Response('boom', { status: 500 });
    const stale = await get('/items/I1', asPerson);
    expect(stale.status).toBe(200);
    expect(await stale.text()).toBe(svg('drawn'));
    people.set('X', { item: item({ id: 'X' }) });
    expect((await get('/items/X', asPerson)).status).toBe(503);
  });

  it('has no preview for an app with no door configured', async () => {
    people.set('D', { item: item({ id: 'D', app: 'livedesign' }) });
    expect((await get('/items/D', asPerson)).status).toBe(503);
    expect(doorCalls).toHaveLength(0);
  });
});

describe('a public link (a Community post’s)', () => {
  it('asks the app every time, conditionally, and stops when the app refuses', async () => {
    links.set('POST', { item: item({ app: 'livediagram' }), tabId: null, public: true });
    db.env.MEDIA_KEY_LIVEDIAGRAM = 'ld-key';
    door = (_url, request) =>
      request.headers.get('If-None-Match') === '"150"'
        ? new Response(null, { status: 304, headers: { ETag: '"150"' } })
        : new Response(svg('redacted'), { headers: { ETag: '"150"' } });
    const first = await get('/share/POST/image.svg');
    expect(first.headers.get('Cache-Control')).toBe('public, max-age=30');
    expect(await first.text()).toBe(svg('redacted'));
    expect(new URL(doorCalls[0]!.url).searchParams.get('code')).toBe('POST');
    expect(db.objects.has('previews/livediagram/I1/public-first.svg')).toBe(true);

    const second = await get('/share/POST/image.svg');
    expect(await second.text()).toBe(svg('redacted'));
    expect(doorCalls[1]!.headers.get('If-None-Match')).toBe('"150"');

    // The post is hidden: the app says no, and nothing stored is served.
    door = () => new Response(null, { status: 404 });
    expect((await get('/share/POST/image.svg')).status).toBe(404);
    expect((await get('/share/POST/card')).status).toBe(404);
  });
});

describe('the share doors', () => {
  beforeEach(() => {
    links.set('CODE', { item: item(), tabId: null });
  });

  it('serves the live image with its cache, and a tab only as the link allows', async () => {
    const res = await get('/share/CODE/image.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=300');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    await get('/share/CODE/image.svg?tab=T9');
    expect(new URL(doorCalls.at(-1)!.url).searchParams.get('tab')).toBe('T9');

    links.set('TAB', { item: item(), tabId: 'T1' });
    expect((await get('/share/TAB/image.svg?tab=T9')).status).toBe(404);
    expect((await get('/share/TAB/image.svg?tab=T1')).status).toBe(200);
  });

  it('answers an unknown or closed code as missing, asking no app', async () => {
    expect((await get('/share/NOPE/image.svg')).status).toBe(404);
    expect((await get('/share/NOPE/image.png')).status).toBe(404);
    expect((await get('/share/NOPE/card')).status).toBe(404);
    expect(doorCalls).toHaveLength(0);
  });

  it('draws the card once per drawing, and the brand card for nothing to draw', async () => {
    const card = await get('/share/CODE/image.png');
    expect(card.headers.get('Content-Type')).toBe('image/png');
    expect(card.headers.get('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=3600',
    );
    expect(await card.text()).toBe(`PNG(${svg('drawn')})`);
    const { shareCardPng } = await import('./share-card-png');
    expect(shareCardPng).toHaveBeenCalledTimes(1);
    await get('/share/CODE/image.png');
    expect(shareCardPng).toHaveBeenCalledTimes(1);
    expect(doorCalls).toHaveLength(1);

    links.set('EMPTY', { item: item({ id: 'E2', summary: { empty: true } }), tabId: null });
    const brand = await get('/share/EMPTY/image.png');
    expect(brand.status).toBe(302);
    expect(brand.headers.get('Location')).toBe('/opengraph-image');
  });

  it('names the item for the share page', async () => {
    const res = await get('/share/CODE/card');
    expect(await res.json()).toEqual({ name: 'Roadmap' });
    expect(doorCalls).toHaveLength(0);
  });
});

describe('purging an item', () => {
  it('deletes its previews, only for the app that asks', async () => {
    people.set('I1', { item: item() });
    links.set('CODE', { item: item(), tabId: null });
    await get('/items/I1', asPerson);
    await get('/share/CODE/image.png');
    expect([...db.objects.keys()].filter((k) => k.startsWith('previews/'))).toHaveLength(2);

    const asApp = (app: string, key: string) =>
      worker.fetch(
        new Request('https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/media/app/previews/I1', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${key}`, 'X-Media-App': app },
        }),
        db.env,
      );
    const other = await asApp('livediagram.app', 'ld-key');
    expect(await other.json()).toEqual({ deleted: 0 });
    const own = await asApp('liveplanner.app', 'lp-key');
    expect(await own.json()).toEqual({ deleted: 2 });
    expect([...db.objects.keys()].filter((k) => k.startsWith('previews/'))).toHaveLength(0);
  });
});
