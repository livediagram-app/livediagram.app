import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';

// Route surface for the Explorer's "Shared with you" accordion. Everything
// here is keyed off the RESOLVED owner rather than anything the caller names,
// which is what stops one visitor listing — or dismissing — another's shared
// diagrams. The guest path has to keep working too: shared_with rows are keyed
// off the same resolved string whether it came from a Clerk session or an
// X-Owner-Id header (docs/specs/014-identity/auth-and-guest-access.md).

const { db } = vi.hoisted(() => ({
  db: {
    listSharedWith: vi.fn(),
    dropSharedAccess: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleShared } from './shared';

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
  db.listSharedWith.mockResolvedValue([]);
});

describe('GET /api/shared', () => {
  it('lists what was shared with the resolved owner', async () => {
    const item = { id: 'diag-1', name: 'Roadmap', role: 'view' };
    db.listSharedWith.mockResolvedValue([item]);
    const res = await handleShared(makeCtx('GET', '/api/shared'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shared: [item] });
    expect(db.listSharedWith).toHaveBeenCalledWith(expect.anything(), 'owner-1');
  });

  it('serves a guest owner exactly as it serves a signed-in one', async () => {
    // docs/specs/014-identity/auth-and-guest-access.md: the canvas works without signing in, and so does everything
    // hanging off it. A guest id is a first-class owner here.
    await handleShared(makeCtx('GET', '/api/shared', { owner: 'guest-uuid' }));
    expect(db.listSharedWith).toHaveBeenCalledWith(expect.anything(), 'guest-uuid');
  });

  it('400s with no owner, and reads nothing', async () => {
    const res = await handleShared(makeCtx('GET', '/api/shared', { owner: null }));
    expect(res.status).toBe(400);
    expect(db.listSharedWith).not.toHaveBeenCalled();
  });

  it('404s a method the collection does not answer', async () => {
    const res = await handleShared(makeCtx('POST', '/api/shared'));
    expect(res.status).toBe(404);
    expect(db.listSharedWith).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/shared/:diagramId', () => {
  it('drops only this owner’s reference to the diagram', async () => {
    // The row is (owner, diagram): dismissing a shared diagram must not touch
    // anyone else's copy of the same reference, nor the diagram itself.
    const res = await handleShared(makeCtx('DELETE', '/api/shared/diag-1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.dropSharedAccess).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'diag-1');
  });

  it('400s with no owner, and deletes nothing', async () => {
    const res = await handleShared(makeCtx('DELETE', '/api/shared/diag-1', { owner: null }));
    expect(res.status).toBe(400);
    expect(db.dropSharedAccess).not.toHaveBeenCalled();
  });

  it('404s a method the item does not answer', async () => {
    const res = await handleShared(makeCtx('GET', '/api/shared/diag-1'));
    expect(res.status).toBe(404);
    expect(db.dropSharedAccess).not.toHaveBeenCalled();
  });
});

describe('handleShared routing', () => {
  it('404s a path that is not /api/shared', async () => {
    const res = await handleShared(makeCtx('GET', '/api/diagrams'));
    expect(res.status).toBe(404);
  });

  it('404s a path nested deeper than one diagram id', async () => {
    const res = await handleShared(makeCtx('DELETE', '/api/shared/diag-1/extra'));
    expect(res.status).toBe(404);
    expect(db.dropSharedAccess).not.toHaveBeenCalled();
  });
});
