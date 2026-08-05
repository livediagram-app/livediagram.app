import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The read surface for the Explorer's landing feed (spec/138 §6).
//
// The `scope` query parameter is the interesting part: it exists so the
// wire shape is fixed before a second scope type ships, but in v1 the
// ONLY scope anyone may read is their own. A bug there would let a
// caller read another owner's diagram names and comment text, so the
// authorisation cases below carry the weight of this file.

const { store } = vi.hoisted(() => ({
  store: {
    readTimeline: vi.fn(),
    getScopeState: vi.fn(),
    markScopeSeen: vi.fn(),
    countUnseen: vi.fn(),
  },
}));
vi.mock('../db/timeline', () => store);

const { emit } = vi.hoisted(() => ({ emit: { backfillUserScope: vi.fn() } }));
vi.mock('../timeline', () => emit);

const { db } = vi.hoisted(() => ({ db: { getMembership: vi.fn(), getDiagram: vi.fn() } }));
vi.mock('../db', () => db);

const { gate } = vi.hoisted(() => ({ gate: { gateRead: vi.fn() } }));
vi.mock('./context', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, gateRead: gate.gateRead };
});

import type { RouteContext } from './context';
import { handleTimeline } from './timeline';

const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; verifiedUserId?: string | null } = {},
): RouteContext => {
  const ctx = makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });
  if (opts.verifiedUserId !== undefined) ctx.verifiedUserId = opts.verifiedUserId;
  return ctx;
};

beforeEach(() => {
  for (const fn of Object.values(store)) fn.mockReset();
  emit.backfillUserScope.mockReset();
  db.getMembership.mockReset();
  db.getMembership.mockResolvedValue(null);
  db.getDiagram.mockReset();
  db.getDiagram.mockResolvedValue({ id: 'd-1', ownerId: 'owner-1', teamId: null });
  gate.gateRead.mockReset();
  gate.gateRead.mockResolvedValue(false);
  store.readTimeline.mockResolvedValue({ items: [] });
  store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastSeenAt: 2 });
  store.markScopeSeen.mockResolvedValue(undefined);
  store.countUnseen.mockResolvedValue(0);
  emit.backfillUserScope.mockResolvedValue(undefined);
});

describe('handleTimeline read', () => {
  it('400 when no owner resolves — a feed has to belong to someone', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline', { owner: null }));
    expect(res.status).toBe(400);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  it('defaults to the callers own scope when none is given', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline'));
    expect(res.status).toBe(200);
    expect(store.readTimeline).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ scope: { scopeType: 'user', scopeId: 'owner-1' } }),
    );
  });

  // The one that matters. Without it the scope parameter is an
  // enumeration of every other user's feed.
  it('403s a scope belonging to somebody else', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=user:someone-else'));
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  it('403s a scope type that has no rule yet', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=nonsense:abc'));
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // A diagram's history is readable by exactly whoever can read the
  // diagram — which includes a share-link visitor who is in nobody's
  // user scope, so it defers to the diagram's own gate rather than
  // re-deriving one.
  it('serves a diagram scope to anyone the diagram gate allows', async () => {
    gate.gateRead.mockResolvedValue(true);
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=diagram:d-1'));
    expect(res.status).toBe(200);
    // Called with the whole RouteContext (it needs the share-code
    // headers), so assert the diagram identity rather than the ctx.
    expect(gate.gateRead).toHaveBeenCalledWith(expect.anything(), 'd-1', 'owner-1', null);
  });

  it('403s a diagram scope the gate refuses', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=diagram:d-1'));
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // A refusal, not a 404: a guessed id must not be probeable for
  // existence through this endpoint any more than through the diagram's.
  it('403s a diagram scope for an id that does not exist', async () => {
    db.getDiagram.mockResolvedValue(null);
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=diagram:missing'));
    expect(res.status).toBe(403);
    expect(gate.gateRead).not.toHaveBeenCalled();
  });

  // A team feed carries the team's diagram names and comment text, so
  // membership is the whole gate.
  it('serves a team scope to a joined member', async () => {
    db.getMembership.mockResolvedValue({ status: 'joined', role: 'member' });
    const res = await handleTimeline(
      makeCtx('GET', '/api/timeline?scope=team:t-1', { verifiedUserId: 'owner-1' }),
    );
    expect(res.status).toBe(200);
    expect(store.readTimeline).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ scope: { scopeType: 'team', scopeId: 't-1' } }),
    );
  });

  it('403s a team scope for a non-member', async () => {
    const res = await handleTimeline(
      makeCtx('GET', '/api/timeline?scope=team:t-1', { verifiedUserId: 'stranger' }),
    );
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // An invite grants no access to the team's content (spec/32), and its
  // feed is content.
  it('403s a team scope for an invited-but-not-joined member', async () => {
    db.getMembership.mockResolvedValue({ status: 'invited', role: 'member' });
    const res = await handleTimeline(
      makeCtx('GET', '/api/timeline?scope=team:t-1', { verifiedUserId: 'owner-1' }),
    );
    expect(res.status).toBe(403);
  });

  it('403s a team scope for a guest — teams are Clerk-only', async () => {
    const res = await handleTimeline(
      makeCtx('GET', '/api/timeline?scope=team:t-1', { verifiedUserId: null }),
    );
    expect(res.status).toBe(403);
    expect(db.getMembership).not.toHaveBeenCalled();
  });

  // The seed walks the CALLER's library, which is meaningless for a team.
  it('does not seed a team scope', async () => {
    db.getMembership.mockResolvedValue({ status: 'joined', role: 'member' });
    store.getScopeState.mockResolvedValue(null);
    const ctx = makeCtx('GET', '/api/timeline?scope=team:t-1', { verifiedUserId: 'owner-1' });
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    await handleTimeline(ctx);
    await Promise.all(scheduled);
    expect(emit.backfillUserScope).not.toHaveBeenCalled();
    expect(store.markScopeSeen).not.toHaveBeenCalled();
  });

  // A 400 rather than a silent fall back to the caller's own scope: a
  // client that meant to ask for something else should hear about it.
  it('400s a malformed scope instead of quietly serving your own', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=nonsense'));
    expect(res.status).toBe(400);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  it('passes the cursor, range, and source-type filters through', async () => {
    await handleTimeline(
      makeCtx(
        'GET',
        '/api/timeline?cursor=100:abc&from=50&to=200&sourceType=diagram&sourceType=team',
      ),
    );
    expect(store.readTimeline).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cursor: '100:abc',
        from: 50,
        to: 200,
        sourceTypes: ['diagram', 'team'],
      }),
    );
  });

  it('caps an oversized limit rather than trusting the client', async () => {
    await handleTimeline(makeCtx('GET', '/api/timeline?limit=99999'));
    expect(store.readTimeline).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 200 }));
  });

  it('falls back to the default page size for a nonsense limit', async () => {
    await handleTimeline(makeCtx('GET', '/api/timeline?limit=-4'));
    expect(store.readTimeline).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 50 }));
  });

  it('returns the page plus the cursor and last-refreshed stamp', async () => {
    store.readTimeline.mockResolvedValue({ items: [{ id: 'e1' }], nextCursor: '9:e1' });
    const res = await handleTimeline(makeCtx('GET', '/api/timeline'));
    expect(await res.json()).toEqual({
      items: [{ id: 'e1' }],
      nextCursor: '9:e1',
      lastSeenAt: 2,
    });
  });

  // The watermark has to be the value from BEFORE this read, or the
  // reader is told nothing is new on the very visit that would show it.
  it('reports the watermark as it stood before the read, then moves it', async () => {
    const ctx = makeCtx('GET', '/api/timeline');
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    const res = await handleTimeline(ctx);
    expect(((await res.json()) as { lastSeenAt: number }).lastSeenAt).toBe(2);
    await Promise.all(scheduled);
    expect(store.markScopeSeen).toHaveBeenCalled();
  });

  // Paging backwards through history must not mark the whole feed seen
  // halfway down it.
  // Inside the visit window the watermark holds still, so the New
  // markers survive a client that fetches twice on mount.
  it('does not move the watermark twice inside one visit', async () => {
    store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastSeenAt: Date.now() - 1000 });
    const ctx = makeCtx('GET', '/api/timeline');
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    await handleTimeline(ctx);
    await Promise.all(scheduled);
    expect(store.markScopeSeen).not.toHaveBeenCalled();
  });

  it('does not move the watermark when paging', async () => {
    const ctx = makeCtx('GET', '/api/timeline?cursor=100:abc');
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    await handleTimeline(ctx);
    await Promise.all(scheduled);
    expect(store.markScopeSeen).not.toHaveBeenCalled();
  });

  // Seeding walks the caller's whole library, so it runs after the
  // response rather than holding it.
  it('seeds a never-backfilled scope off the response path', async () => {
    store.getScopeState.mockResolvedValue(null);
    const ctx = makeCtx('GET', '/api/timeline');
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    const res = await handleTimeline(ctx);
    expect(res.status).toBe(200);
    await Promise.all(scheduled);
    expect(emit.backfillUserScope).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('does not re-seed a scope that has already been backfilled', async () => {
    const ctx = makeCtx('GET', '/api/timeline');
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    await handleTimeline(ctx);
    await Promise.all(scheduled);
    expect(emit.backfillUserScope).not.toHaveBeenCalled();
  });

  // Nothing user-authored lives on this feed, so there is nothing to
  // write. A POST to the read path must not fall through to anything.
  it('404s writes to the collection path', async () => {
    expect((await handleTimeline(makeCtx('POST', '/api/timeline'))).status).toBe(404);
    expect((await handleTimeline(makeCtx('DELETE', '/api/timeline'))).status).toBe(404);
  });
});

describe('handleTimeline unread', () => {
  it('counts events since the watermark', async () => {
    store.countUnseen.mockResolvedValue(7);
    const res = await handleTimeline(makeCtx('GET', '/api/timeline/unread'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 7 });
    expect(store.countUnseen).toHaveBeenCalledWith({}, expect.anything(), 2);
  });

  // Greeting a long-time user with "99+" on a feature they have never
  // opened would be a lie about what they missed.
  it('reports nothing when the reader has never opened the feed', async () => {
    store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastSeenAt: null });
    const res = await handleTimeline(makeCtx('GET', '/api/timeline/unread'));
    expect(await res.json()).toEqual({ count: 0 });
    expect(store.countUnseen).not.toHaveBeenCalled();
  });

  it('400s with no owner', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline/unread', { owner: null }));
    expect(res.status).toBe(400);
  });
});

describe('handleTimeline refresh', () => {
  it('seeds and marks seen on a first-ever call', async () => {
    store.getScopeState.mockResolvedValue(null);
    const res = await handleTimeline(makeCtx('POST', '/api/timeline/refresh'));
    expect(res.status).toBe(200);
    expect(emit.backfillUserScope).toHaveBeenCalledWith({}, 'owner-1');
    expect(store.markScopeSeen).toHaveBeenCalled();
  });

  // A scripted caller must not be able to turn this into a write storm.
  it('throttles a repeat call inside the window', async () => {
    store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastSeenAt: Date.now() });
    const res = await handleTimeline(makeCtx('POST', '/api/timeline/refresh'));
    expect(res.status).toBe(200);
    expect(store.markScopeSeen).not.toHaveBeenCalled();
  });

  it('400s with no owner', async () => {
    const res = await handleTimeline(makeCtx('POST', '/api/timeline/refresh', { owner: null }));
    expect(res.status).toBe(400);
  });
});
