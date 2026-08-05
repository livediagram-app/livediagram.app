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
    markScopeRefreshed: vi.fn(),
  },
}));
vi.mock('../db/timeline', () => store);

const { emit } = vi.hoisted(() => ({ emit: { backfillUserScope: vi.fn() } }));
vi.mock('../timeline', () => emit);

import type { RouteContext } from './context';
import { handleTimeline } from './timeline';

const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });

beforeEach(() => {
  for (const fn of Object.values(store)) fn.mockReset();
  emit.backfillUserScope.mockReset();
  store.readTimeline.mockResolvedValue({ items: [] });
  store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastRefreshedAt: 2 });
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

  it('403s a scope type that has not shipped yet', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=diagram:abc'));
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
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
      lastRefreshedAt: 2,
    });
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

describe('handleTimeline refresh', () => {
  it('stamps the scope and returns the new time', async () => {
    store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastRefreshedAt: 0 });
    store.markScopeRefreshed.mockResolvedValue(4242);
    const res = await handleTimeline(makeCtx('POST', '/api/timeline/refresh'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lastRefreshedAt: 4242 });
  });

  // A held-down Refresh button must not turn into a write storm. The
  // existing stamp comes back rather than an error: the caller asked for
  // the freshest feed and already has one.
  it('throttles a repeat refresh inside the window', async () => {
    store.getScopeState.mockResolvedValue({ backfilledAt: 1, lastRefreshedAt: Date.now() });
    const res = await handleTimeline(makeCtx('POST', '/api/timeline/refresh'));
    expect(res.status).toBe(200);
    expect(store.markScopeRefreshed).not.toHaveBeenCalled();
  });

  it('seeds inline on a first-ever refresh', async () => {
    store.getScopeState.mockResolvedValue(null);
    store.markScopeRefreshed.mockResolvedValue(1);
    await handleTimeline(makeCtx('POST', '/api/timeline/refresh'));
    expect(emit.backfillUserScope).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('400s a refresh with no owner', async () => {
    const res = await handleTimeline(makeCtx('POST', '/api/timeline/refresh', { owner: null }));
    expect(res.status).toBe(400);
  });
});
