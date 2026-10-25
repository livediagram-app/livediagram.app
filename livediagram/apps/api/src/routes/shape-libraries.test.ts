import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SHAPE_LIBRARIES_PER_OWNER,
  MAX_SHAPE_LIBRARY_ITEMS,
  MAX_TAB_BYTES,
  type ShapeLibraryItem,
} from '@livediagram/api-schema';
import { testPersonStores } from '../test-person-store';
import type { Env } from '../types';
import type { RouteContext } from './context';
import { handleShapeLibraries, shapePreviews } from './shape-libraries';

// handleShapeLibraries (docs/specs/013-workspace/blueprints/shape-libraries.md "Interfaces and
// contracts"): each person's libraries in their own store, plus the cap, the size budget, item
// validation and the name rules. Runs against real PersonStores on node:sqlite.

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
const create = async (over: Record<string, unknown> = {}, owner = 'owner-1') => {
  const res = await send('POST', '/api/shape-libraries', { body: body(over), owner });
  expect(res.status).toBe(201);
  return (await res.json<{ library: { id: string; name: string } }>()).library;
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
});

describe('POST /api/shape-libraries', () => {
  it('creates a library for the person, trimmed', async () => {
    const library = await create({ name: '  Team icons ' });
    expect(library).toMatchObject({ id: 'lib-1', name: 'Team icons', ownerId: 'owner-1' });
  });

  it('suffixes a name the person already uses', async () => {
    await create({ id: 'a', name: 'team icons' });
    await create({ id: 'b', name: 'Team icons (2)' });
    expect((await create({ id: 'c' })).name).toBe('Team icons (3)');
  });

  it.each([
    ['no id', { id: undefined }],
    ['a malformed id', { id: 'a/b' }],
    ['an empty name', { name: '  ' }],
    ['an unknown source', { source: 'visio' }],
    ['items that are not a list', { items: 'x' }],
    ['an invalid element', { items: [{ ...item, elements: [{ id: 'x', type: 'nope' }] }] }],
  ])('400 for %s', async (_, over) => {
    const res = await send('POST', '/api/shape-libraries', { body: body(over) });
    expect(res.status).toBe(400);
    expect(await list()).toEqual([]);
  });

  it('409 at the cap', async () => {
    for (let i = 0; i < MAX_SHAPE_LIBRARIES_PER_OWNER; i++) {
      await create({ id: `L${i}`, name: `L${i}` });
    }
    const res = await send('POST', '/api/shape-libraries', { body: body() });
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('shape_library_cap');
  });

  it('409 for an id the person already uses', async () => {
    await create();
    const res = await send('POST', '/api/shape-libraries', { body: body({ name: 'Other' }) });
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('shape_library_exists');
  });

  it('413 over the row budget', async () => {
    const big = { ...item, title: '', elements: [{ ...square, label: 'x'.repeat(MAX_TAB_BYTES) }] };
    const res = await send('POST', '/api/shape-libraries', { body: body({ items: [big] }) });
    expect(res.status).toBe(413);
    expect(await list()).toEqual([]);
  });
});

describe('PUT /api/shape-libraries/:id', () => {
  it("404 for a missing library, and for another person's", async () => {
    await create({}, 'owner-2');
    expect((await send('PUT', '/api/shape-libraries/lib-9', { body: { name: 'x' } })).status).toBe(
      404,
    );
    expect((await send('PUT', '/api/shape-libraries/lib-1', { body: { name: 'x' } })).status).toBe(
      404,
    );
    expect((await list('owner-2'))[0]!.name).toBe('Team icons');
  });

  it('renames, refusing a name another library uses but not its own', async () => {
    await create();
    await create({ id: 'lib-2', name: 'UML' });
    const clash = await send('PUT', '/api/shape-libraries/lib-1', { body: { name: 'uml' } });
    expect(clash.status).toBe(409);
    expect(await errorOf(clash)).toBe('shape_library_name_taken');
    const same = await send('PUT', '/api/shape-libraries/lib-1', { body: { name: 'TEAM ICONS' } });
    expect(same.status).toBe(200);
    expect((await same.json<{ library: { name: string } }>()).library.name).toBe('TEAM ICONS');
  });

  it('replaces the items with validated ones', async () => {
    await create();
    const res = await send('PUT', '/api/shape-libraries/lib-1', { body: { items: [] } });
    expect(res.status).toBe(200);
    expect((await list())[0]!.items).toEqual([]);
  });

  it('400 for invalid items or name', async () => {
    await create();
    for (const b of [{ items: [{ id: '' }] }, { name: '' }]) {
      expect((await send('PUT', '/api/shape-libraries/lib-1', { body: b })).status).toBe(400);
    }
    expect((await list())[0]).toMatchObject({ name: 'Team icons', items: [item] });
  });
});

describe('DELETE /api/shape-libraries/:id', () => {
  it("deletes the person's library; 404 for another's", async () => {
    await create();
    await create({ id: 'lib-2' }, 'owner-2');
    expect((await send('DELETE', '/api/shape-libraries/lib-1')).status).toBe(204);
    expect(await list()).toEqual([]);
    expect((await send('DELETE', '/api/shape-libraries/lib-2')).status).toBe(404);
    expect(await list('owner-2')).toHaveLength(1);
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
    const started = performance.now();
    const previews = shapePreviews(items);
    const ms = performance.now() - started;
    const bytes = JSON.stringify({ previews }).length;
    expect(Object.keys(previews)).toHaveLength(MAX_SHAPE_LIBRARY_ITEMS);
    // Measured 62 ms and 1.2 MB (before compression) on a laptop; the budgets leave CI room.
    expect(ms).toBeLessThan(500);
    expect(bytes).toBeLessThan(2_000_000);
  });
});
