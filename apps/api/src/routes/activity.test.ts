import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Route surface for the Activity page (docs/specs/013-workspace/activity-page.md §3). The read is scoped
// to the resolved owner inside the db layer (docs/specs/013-workspace/activity-page.md §4), so what the
// route has to get right is the owner gate, the verb surface, and the
// one-shot backfill dispatch on first sight.

const { db, backfill } = vi.hoisted(() => ({
  db: {
    readActivity: vi.fn(),
    getCollabIndexState: vi.fn(),
  },
  backfill: { backfillCollabIndex: vi.fn() },
}));
vi.mock('../db', () => db);
vi.mock('../collab-index/backfill', () => backfill);

import type { RouteContext } from './context';
import { handleActivity } from './activity';

const EMPTY = { actions: [], threads: [] };

const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; waitUntil?: (p: Promise<unknown>) => void } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
    ...(opts.waitUntil ? { waitUntil: opts.waitUntil } : {}),
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  backfill.backfillCollabIndex.mockReset();
  db.readActivity.mockResolvedValue(EMPTY);
  db.getCollabIndexState.mockResolvedValue({ backfilledAt: 1 });
  backfill.backfillCollabIndex.mockResolvedValue(undefined);
});

describe('handleActivity', () => {
  it('refuses a read with no owner — the page is somebody’s', async () => {
    const res = await handleActivity(makeCtx('GET', '/api/activity', { owner: null }));
    expect(res.status).toBe(400);
    expect(db.readActivity).not.toHaveBeenCalled();
  });

  it('reads for the resolved owner, capped, and returns both lists', async () => {
    const action = { id: 'a1', name: 'Confirm', assignedToMe: true };
    db.readActivity.mockResolvedValue({ actions: [action], threads: [] });
    const res = await handleActivity(makeCtx('GET', '/api/activity'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ actions: [action], threads: [] });
    expect(db.readActivity).toHaveBeenCalledWith({}, 'owner-1', { limit: 100 });
  });

  it('seeds the index off the response path the first time an owner reads', async () => {
    db.getCollabIndexState.mockResolvedValue(null);
    const waited: Promise<unknown>[] = [];
    const res = await handleActivity(
      makeCtx('GET', '/api/activity', { waitUntil: (p) => waited.push(p) }),
    );
    expect(res.status).toBe(200);
    expect(waited).toHaveLength(1);
    await Promise.all(waited);
    expect(backfill.backfillCollabIndex).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('does not seed again once stamped', async () => {
    const waited: Promise<unknown>[] = [];
    await handleActivity(makeCtx('GET', '/api/activity', { waitUntil: (p) => waited.push(p) }));
    expect(waited).toHaveLength(0);
    expect(backfill.backfillCollabIndex).not.toHaveBeenCalled();
  });

  it('a failed seed never fails the read', async () => {
    db.getCollabIndexState.mockResolvedValue(null);
    backfill.backfillCollabIndex.mockRejectedValue(new Error('d1 hiccup'));
    const waited: Promise<unknown>[] = [];
    const res = await handleActivity(
      makeCtx('GET', '/api/activity', { waitUntil: (p) => waited.push(p) }),
    );
    expect(res.status).toBe(200);
    await expect(Promise.all(waited)).resolves.toBeDefined();
  });

  it('is read-only: no other verb, no sub-resource', async () => {
    expect((await handleActivity(makeCtx('POST', '/api/activity'))).status).toBe(404);
    expect((await handleActivity(makeCtx('DELETE', '/api/activity'))).status).toBe(404);
    expect((await handleActivity(makeCtx('GET', '/api/activity/x'))).status).toBe(404);
    expect(db.readActivity).not.toHaveBeenCalled();
  });
});
