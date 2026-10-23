import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Route surface for the Inbox (docs/specs/013-workspace/inbox.md §3). The read is scoped
// to the resolved owner inside the db layer (docs/specs/013-workspace/inbox.md §4), so what the
// route has to get right is the owner gate and the verb surface. The index is pushed by each plan
// (plan-room/plan-outbox.ts), so there is nothing to seed on first sight.

const { db } = vi.hoisted(() => ({
  db: {
    readActivity: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleActivity } from './activity';

const EMPTY = { actions: [], threads: [], cards: [], cardThreads: [] };

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
  db.readActivity.mockResolvedValue(EMPTY);
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

  it('schedules no background work', async () => {
    const waited: Promise<unknown>[] = [];
    await handleActivity(makeCtx('GET', '/api/activity', { waitUntil: (p) => waited.push(p) }));
    expect(waited).toHaveLength(0);
  });

  it('is read-only: no other verb, no sub-resource', async () => {
    expect((await handleActivity(makeCtx('POST', '/api/activity'))).status).toBe(404);
    expect((await handleActivity(makeCtx('DELETE', '/api/activity'))).status).toBe(404);
    expect((await handleActivity(makeCtx('GET', '/api/activity/x'))).status).toBe(404);
    expect(db.readActivity).not.toHaveBeenCalled();
  });
});
