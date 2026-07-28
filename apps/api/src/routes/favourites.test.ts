import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Route surface for per-user diagram stars (spec/95). Favourites are
// deliberately owner-scoped with NO diagram-access check — a star is a
// private bookmark that grants nothing — so what matters here is that the
// owner gate holds and that every id reaching the db layer is scoped to
// the resolved owner.

const { db } = vi.hoisted(() => ({
  db: {
    listFavouriteIds: vi.fn(),
    addFavourite: vi.fn(),
    removeFavourite: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleFavourites } from './favourites';

const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleFavourites', () => {
  it('400 when no owner resolves — a star has to belong to someone', async () => {
    const res = await handleFavourites(makeCtx('GET', '/api/favourites', { owner: null }));
    expect(res.status).toBe(400);
    expect(db.listFavouriteIds).not.toHaveBeenCalled();
  });

  it('lists the ids scoped to the resolved owner', async () => {
    db.listFavouriteIds.mockResolvedValue(['d1', 'd2']);
    const res = await handleFavourites(makeCtx('GET', '/api/favourites'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ids: ['d1', 'd2'] });
    expect(db.listFavouriteIds).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('PUT stars the diagram for THIS owner', async () => {
    const res = await handleFavourites(makeCtx('PUT', '/api/favourites/d1'));
    expect(res.status).toBe(204);
    expect(db.addFavourite).toHaveBeenCalledWith({}, 'owner-1', 'd1');
  });

  it('DELETE un-stars it', async () => {
    const res = await handleFavourites(makeCtx('DELETE', '/api/favourites/d1'));
    expect(res.status).toBe(204);
    expect(db.removeFavourite).toHaveBeenCalledWith({}, 'owner-1', 'd1');
  });

  it('the owner always comes from resolveOwner, never the path', async () => {
    // The owner is always the RESOLVED one, never anything from the path.
    await handleFavourites(makeCtx('PUT', '/api/favourites/d1', { owner: 'owner-2' }));
    expect(db.addFavourite).toHaveBeenCalledWith({}, 'owner-2', 'd1');
  });

  it('404s a write with no diagram id, rather than starring nothing', async () => {
    const res = await handleFavourites(makeCtx('PUT', '/api/favourites'));
    expect(res.status).toBe(404);
    expect(db.addFavourite).not.toHaveBeenCalled();
  });

  it('404s an unsupported method', async () => {
    const res = await handleFavourites(makeCtx('POST', '/api/favourites/d1'));
    expect(res.status).toBe(404);
    expect(db.addFavourite).not.toHaveBeenCalled();
  });
});
