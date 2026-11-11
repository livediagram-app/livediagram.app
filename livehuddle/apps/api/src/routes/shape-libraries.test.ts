import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  MAX_SHAPE_LIBRARIES_PER_OWNER,
  MAX_SHAPE_LIBRARY_ITEMS,
  MAX_TAB_BYTES,
  type ShapeLibraryItem,
} from '@livehuddle/api-schema';
import { personStore } from '../person-client';
import { testPersonStores } from '../test-person-store';
import type { Env } from '../types';
import type { RouteContext } from './context';
import { handleShapeLibraries, shapePreviews } from './shape-libraries';

// handleShapeLibraries (docs/specs/013-workspace/blueprints/shape-libraries.md "Interfaces and
// contracts"): each person's libraries in their own store, read-only since Work Tracker #515 (the
// cap, size budget and name rules live in the store's own tests). Runs against real PersonStores
// on node:sqlite.

const square = { id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60 };
const item = { id: 'i1', title: 'Service', width: 120, height: 60, elements: [square] };
const body = (over: Record<string, unknown> = {}) => ({
  id: 'lib-1',
  name: 'Team icons',
  source: 'drawio',
  items: [item],
  ...over,
});

let env: Env;
const ctx = (
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
    env,
  });
const send = (method: string, path: string, opts: { owner?: string | null; body?: unknown } = {}) =>
  handleShapeLibraries(ctx(method, path, opts));
const errorOf = async (res: Response) => (await res.json<{ error: string }>()).error;
// The routes no longer write, so a stored library is seeded the way an old import left it: straight into the store.
const create = async (over: Record<string, unknown> = {}, owner = 'owner-1') => {
  const { id, name, items } = body(over) as { id: string; name: string; items: ShapeLibraryItem[] };
  const library = await personStore(env, owner).createShapeLibrary(
    { id, name, source: 'drawio', items },
    MAX_SHAPE_LIBRARIES_PER_OWNER,
  );
  expect(typeof library).toBe('object');
  return library as { id: string; name: string };
};
const list = async (owner = 'owner-1') =>
  (
    await (
      await send('GET', '/api/shape-libraries', { owner })
    ).json<{
      libraries: { id: string; name: string; ownerId: string; items: unknown[] }[];
    }>()
  ).libraries;

beforeEach(() => {
  env = { PERSON_STORE: testPersonStores() } as unknown as Env;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('GET /api/shape-libraries', () => {
  it('400 without an owner', async () => {
    expect((await send('GET', '/api/shape-libraries', { owner: null })).status).toBe(400);
  });

  it("lists the person's own libraries, newest first, and nobody else's", async () => {
    expect(await list()).toEqual([]);
    await create();
    await create({ id: 'lib-2', name: 'UML' });
    await create({ id: 'lib-3', name: 'Theirs' }, 'owner-2');
    const mine = await list();
    expect(mine.map((l) => l.id).sort()).toEqual(['lib-1', 'lib-2']);
    expect(mine.every((l) => l.ownerId === 'owner-1')).toBe(true);
    expect(mine[0]!.items).toEqual([item]);
  });

  it('404 for a path that is not a route of this resource', async () => {
    expect((await send('GET', '/api/shape-libraries/lib-1')).status).toBe(404);
    expect((await send('GET', '/api/other')).status).toBe(404);
  });
});

// Work Tracker #515: every caller is refused the same way, whatever their share role on any Space (this resource is
// the person's own, with no role of its own): the owner, an Editor, a Participant or a Viewer reaching it with a
// token or session, and a caller with no owner at all.
describe('writes are refused', () => {
  const callers: [string, string | null][] = [
    ['the owner', 'owner-1'],
    ['an Editor', 'editor-1'],
    ['a Participant', 'participant-1'],
    ['a Viewer', 'viewer-1'],
    ['an anonymous caller', null],
  ];
  const writes: [string, string, unknown][] = [
    ['POST', '/api/shape-libraries', body({ id: 'lib-new' })],
    ['PUT', '/api/shape-libraries/lib-1', { name: 'Renamed' }],
    ['DELETE', '/api/shape-libraries/lib-1', undefined],
  ];

  it.each(callers.flatMap(([who, owner]) => writes.map((w) => [who, owner, ...w] as const)))(
    '403 shape_libraries_read_only for %s on %s %s',
    async (_who, owner, method, path, payload) => {
      await create();
      const res = await send(method, path, { owner, body: payload });
      expect(res.status).toBe(403);
      expect(await errorOf(res)).toBe('shape_libraries_read_only');
    },
  );

  it('changes, creates and deletes nothing, and still lists what was stored', async () => {
    await create();
    for (const [method, path, payload] of writes) {
      await send(method, path, { body: payload });
    }
    expect(await list()).toMatchObject([{ id: 'lib-1', name: 'Team icons', items: [item] }]);
  });

  it('answers 404, not 403, for a write to a path the resource never had', async () => {
    expect((await send('PUT', '/api/shape-libraries')).status).toBe(404);
    expect((await send('DELETE', '/api/shape-libraries/bad id!')).status).toBe(404);
    expect((await send('POST', '/api/shape-libraries/lib-1/previews')).status).toBe(404);
  });

  it('refuses before reading the body or reaching the store', async () => {
    const stores = env.PERSON_STORE as ReturnType<typeof testPersonStores>;
    const res = await send('POST', '/api/shape-libraries', { owner: 'fresh', body: 'not json' });
    expect(res.status).toBe(403);
    expect(stores.databaseOf('fresh')).toBeUndefined();
  });
});

describe('a person store that never held anything', () => {
  it('is given no storage by a read or a purge', async () => {
    const stores = env.PERSON_STORE as ReturnType<typeof testPersonStores>;
    expect(await list('nobody')).toEqual([]);
    const db = stores.databaseOf('nobody')!;
    expect(db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get()).toEqual({ n: 0 });
  });
});

describe('GET /api/shape-libraries/:id/previews', () => {
  it('draws every shape of the library as an SVG, by shape id, cached privately', async () => {
    const lib = await create({
      items: [item, { ...item, id: 'i2', title: 'Store', elements: [{ ...square, id: 'e2' }] }],
    });
    const res = await send('GET', `/api/shape-libraries/${lib.id}/previews`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    const { previews } = await res.json<{ previews: Record<string, string> }>();
    expect(Object.keys(previews).sort()).toEqual(['i1', 'i2']);
    expect(previews.i1).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(previews.i1).toContain('fill="transparent"');
  });

  it("404 for a missing library, and for another person's", async () => {
    const lib = await create();
    expect((await send('GET', '/api/shape-libraries/nope/previews')).status).toBe(404);
    expect(
      (await send('GET', `/api/shape-libraries/${lib.id}/previews`, { owner: 'owner-2' })).status,
    ).toBe(404);
    expect((await send('GET', '/api/shape-libraries/bad id!/previews')).status).toBe(404);
  });

  it('leaves out a shape the renderer cannot draw, and draws the rest', () => {
    const broken = { ...item, id: 'bad', elements: [null] };
    const fine = { ...item, id: 'ok' };
    const items = [broken, fine] as unknown as ShapeLibraryItem[];
    expect(Object.keys(shapePreviews(items))).toEqual(['ok']);
  });

  it('needs a person', async () => {
    const res = await send('GET', '/api/shape-libraries/lib-1/previews', { owner: null });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // The worst case a library may hold: MAX_SHAPE_LIBRARY_ITEMS shapes, each a small drawing of labelled shapes and an
  // arrow, inside the size budget. One request draws them all.
  it('draws the largest library a person may keep within budget', () => {
    const items = Array.from({ length: MAX_SHAPE_LIBRARY_ITEMS }, (_, i) => ({
      id: `i${i}`,
      title: `Shape ${i}`,
      width: 200,
      height: 120,
      elements: [
        { ...square, id: `a${i}`, label: 'Service' },
        { ...square, id: `b${i}`, x: 140, shape: 'circle', label: 'Store' },
        { ...square, id: `c${i}`, y: 80, shape: 'diamond' },
        {
          id: `l${i}`,
          type: 'arrow',
          from: { kind: 'free', x: 120, y: 30 },
          to: { kind: 'free', x: 140, y: 30 },
        },
      ],
    })) as unknown as ShapeLibraryItem[];
    expect(JSON.stringify(items).length).toBeLessThan(MAX_TAB_BYTES);
    let previews: ReturnType<typeof shapePreviews> = {};
    const ms = cpuMsOf(() => {
      previews = shapePreviews(items);
    });
    const bytes = JSON.stringify({ previews }).length;
    expect(Object.keys(previews)).toHaveLength(MAX_SHAPE_LIBRARY_ITEMS);
    // CPU time, so a busy runner's waiting doesn't count (wall-clock 500 ms failed CI at 534). Measured 68 ms and
    // 2.29 MB (before compression) on a laptop: the square, circle and diamond a stored library holds are retired
    // elements now (not-in-livehuddle.md "The element engine", part 5), each drawn as its labelled placeholder,
    // where they were 1.2 MB as plain outlines. cpuBudgetMs leaves CI room.
    expect(ms).toBeLessThan(cpuBudgetMs(200));
    expect(bytes).toBeLessThan(2_500_000);
  });
});
