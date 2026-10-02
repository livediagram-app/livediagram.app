import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SHAPE_LIBRARIES_PER_OWNER, MAX_TAB_BYTES } from '@livediagram/api-schema';

// handleShapeLibraries (docs/specs/013-workspace/blueprints/shape-libraries.md "Interfaces and
// contracts"): owner-scoped like custom themes, plus the cap, the size budget, item validation and
// the name rules.

const { db } = vi.hoisted(() => ({
  db: {
    listShapeLibrariesByOwner: vi.fn(),
    getShapeLibrary: vi.fn(),
    shapeLibraryNamesByOwner: vi.fn(),
    createShapeLibrary: vi.fn(),
    updateShapeLibrary: vi.fn(),
    deleteShapeLibrary: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleShapeLibraries } from './shape-libraries';

const square = { id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60 };
const item = { id: 'i1', title: 'Service', width: 120, height: 60, elements: [square] };
const body = (over: Record<string, unknown> = {}) => ({
  id: 'lib-1',
  name: 'Team icons',
  source: 'drawio',
  items: [item],
  ...over,
});
const ctx = (
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;
const library = (over: Record<string, unknown> = {}) => ({
  id: 'lib-1',
  ownerId: 'owner-1',
  name: 'Team icons',
  source: 'drawio',
  items: [item],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.shapeLibraryNamesByOwner.mockResolvedValue([]);
  db.getShapeLibrary.mockResolvedValue(null);
  db.createShapeLibrary.mockImplementation(async (_env, lib) => ({
    ...lib,
    createdAt: 1,
    updatedAt: 1,
  }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('GET /api/shape-libraries', () => {
  it('400 without an owner', async () => {
    expect(
      (await handleShapeLibraries(ctx('GET', '/api/shape-libraries', { owner: null }))).status,
    ).toBe(400);
  });

  it("lists the owner's libraries", async () => {
    db.listShapeLibrariesByOwner.mockResolvedValue([library()]);
    const res = await handleShapeLibraries(ctx('GET', '/api/shape-libraries'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ libraries: [library()] });
    expect(db.listShapeLibrariesByOwner).toHaveBeenCalledWith({}, 'owner-1');
  });
});

describe('POST /api/shape-libraries', () => {
  it('creates a library for the owner, trimmed', async () => {
    const res = await handleShapeLibraries(
      ctx('POST', '/api/shape-libraries', { body: body({ name: '  Team icons ' }) }),
    );
    expect(res.status).toBe(201);
    expect(db.createShapeLibrary).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: 'lib-1',
        ownerId: 'owner-1',
        name: 'Team icons',
        source: 'drawio',
      }),
    );
  });

  it('suffixes a name the owner already uses', async () => {
    db.shapeLibraryNamesByOwner.mockResolvedValue(['team icons', 'Team icons (2)']);
    const res = await handleShapeLibraries(ctx('POST', '/api/shape-libraries', { body: body() }));
    expect(((await res.json()) as { library: { name: string } }).library.name).toBe(
      'Team icons (3)',
    );
  });

  it.each([
    ['no id', { id: undefined }],
    ['a malformed id', { id: 'a/b' }],
    ['an empty name', { name: '  ' }],
    ['an unknown source', { source: 'visio' }],
    ['items that are not a list', { items: 'x' }],
    ['an invalid element', { items: [{ ...item, elements: [{ id: 'x', type: 'nope' }] }] }],
  ])('400 for %s', async (_, over) => {
    const res = await handleShapeLibraries(
      ctx('POST', '/api/shape-libraries', { body: body(over) }),
    );
    expect(res.status).toBe(400);
    expect(db.createShapeLibrary).not.toHaveBeenCalled();
  });

  it('409 at the cap', async () => {
    db.shapeLibraryNamesByOwner.mockResolvedValue(
      Array.from({ length: MAX_SHAPE_LIBRARIES_PER_OWNER }, (_, i) => `L${i}`),
    );
    const res = await handleShapeLibraries(ctx('POST', '/api/shape-libraries', { body: body() }));
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('shape_library_cap');
  });

  it('409 for an id already in use', async () => {
    db.getShapeLibrary.mockResolvedValue(library({ ownerId: 'someone-else' }));
    const res = await handleShapeLibraries(ctx('POST', '/api/shape-libraries', { body: body() }));
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('shape_library_exists');
  });

  it('413 over the row budget', async () => {
    const big = { ...item, title: '', elements: [{ ...square, label: 'x'.repeat(MAX_TAB_BYTES) }] };
    const res = await handleShapeLibraries(
      ctx('POST', '/api/shape-libraries', { body: body({ items: [big] }) }),
    );
    expect(res.status).toBe(413);
    expect(db.createShapeLibrary).not.toHaveBeenCalled();
  });
});

describe('PUT /api/shape-libraries/:id', () => {
  it('404 for a missing library and 403 for another owner', async () => {
    expect(
      (
        await handleShapeLibraries(
          ctx('PUT', '/api/shape-libraries/lib-9', { body: { name: 'x' } }),
        )
      ).status,
    ).toBe(404);
    db.getShapeLibrary.mockResolvedValue(library({ ownerId: 'someone-else' }));
    expect(
      (
        await handleShapeLibraries(
          ctx('PUT', '/api/shape-libraries/lib-1', { body: { name: 'x' } }),
        )
      ).status,
    ).toBe(403);
    expect(db.updateShapeLibrary).not.toHaveBeenCalled();
  });

  it('renames, refusing a name another library uses but not its own', async () => {
    db.getShapeLibrary.mockResolvedValue(library());
    db.shapeLibraryNamesByOwner.mockResolvedValue(['Team icons', 'UML']);
    const clash = await handleShapeLibraries(
      ctx('PUT', '/api/shape-libraries/lib-1', { body: { name: 'uml' } }),
    );
    expect(clash.status).toBe(409);
    expect(await errorOf(clash)).toBe('shape_library_name_taken');
    const same = await handleShapeLibraries(
      ctx('PUT', '/api/shape-libraries/lib-1', { body: { name: 'TEAM ICONS' } }),
    );
    expect(same.status).toBe(200);
    expect(db.updateShapeLibrary).toHaveBeenCalledWith({}, 'lib-1', { name: 'TEAM ICONS' });
  });

  it('replaces the items with validated ones', async () => {
    db.getShapeLibrary.mockResolvedValue(library());
    const res = await handleShapeLibraries(
      ctx('PUT', '/api/shape-libraries/lib-1', { body: { items: [] } }),
    );
    expect(res.status).toBe(200);
    expect(db.updateShapeLibrary).toHaveBeenCalledWith({}, 'lib-1', { items: [] });
  });

  it('400 for invalid items or name', async () => {
    db.getShapeLibrary.mockResolvedValue(library());
    for (const b of [{ items: [{ id: '' }] }, { name: '' }]) {
      const res = await handleShapeLibraries(ctx('PUT', '/api/shape-libraries/lib-1', { body: b }));
      expect(res.status).toBe(400);
    }
    expect(db.updateShapeLibrary).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/shape-libraries/:id', () => {
  it("deletes the owner's library; 403 for another's", async () => {
    db.getShapeLibrary.mockResolvedValue(library());
    expect((await handleShapeLibraries(ctx('DELETE', '/api/shape-libraries/lib-1'))).status).toBe(
      204,
    );
    expect(db.deleteShapeLibrary).toHaveBeenCalledWith({}, 'lib-1');
    db.getShapeLibrary.mockResolvedValue(library({ ownerId: 'x' }));
    expect((await handleShapeLibraries(ctx('DELETE', '/api/shape-libraries/lib-1'))).status).toBe(
      403,
    );
  });
});
