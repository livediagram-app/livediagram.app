import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The scoped feeds read from the event record (docs/specs/013-workspace/timeline.md §6): a project's
// History and a team's Activity, and Home's unread count.
//
// The `scope` query parameter is the interesting part: a read must name one, and only a project or a team
// the caller may see is served. A bug there would let a caller read another owner's project names and
// comment text, so the authorisation cases below carry the weight of this file.

const { store } = vi.hoisted(() => ({
  store: {
    readTimeline: vi.fn(),
    getScopeState: vi.fn(),
    countUnseen: vi.fn(),
  },
}));
vi.mock('../db/timeline', () => store);

const { db } = vi.hoisted(() => ({ db: { getMembership: vi.fn(), getProject: vi.fn() } }));
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
  for (const fn of Object.values(store)) if (typeof fn === 'function') fn.mockReset();
  db.getMembership.mockReset();
  db.getMembership.mockResolvedValue(null);
  db.getProject.mockReset();
  db.getProject.mockResolvedValue({ id: 'd-1', ownerId: 'owner-1', teamId: null });
  gate.gateRead.mockReset();
  gate.gateRead.mockResolvedValue(false);
  store.readTimeline.mockResolvedValue({ items: [] });
  store.getScopeState.mockResolvedValue({ lastSeenAt: 2 });
  store.countUnseen.mockResolvedValue(0);
});

describe('handleTimeline read', () => {
  it('400 when no owner resolves — a feed has to belong to someone', async () => {
    const res = await handleTimeline(
      makeCtx('GET', '/api/timeline?scope=project:d-1', { owner: null }),
    );
    expect(res.status).toBe(400);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // The personal feed is gone: a read names its scope rather than falling back to the caller's own.
  it('400s a read that names no scope', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline'));
    expect(res.status).toBe(400);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // Nor may it name a user scope, the caller's own included: refused like a scope with no rule.
  it("403s a user scope, your own or anyone else's", async () => {
    for (const scope of ['user:owner-1', 'user:someone-else']) {
      const res = await handleTimeline(makeCtx('GET', `/api/timeline?scope=${scope}`));
      expect(res.status).toBe(403);
    }
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  it('403s a scope type that has no rule yet', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=nonsense:abc'));
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // A project's history is readable by exactly whoever can read the
  // project — which includes a share-link visitor who is in nobody's
  // user scope, so it defers to the project's own gate rather than
  // re-deriving one.
  it('serves a project scope to anyone the project gate allows', async () => {
    gate.gateRead.mockResolvedValue(true);
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:d-1'));
    expect(res.status).toBe(200);
    // Called with the whole RouteContext (it needs the share-code
    // headers), so assert the project identity rather than the ctx.
    expect(gate.gateRead).toHaveBeenCalledWith(expect.anything(), 'd-1', 'owner-1', null);
  });

  // An owner id is a credential, and a share-link visitor can read a
  // project's feed, so only the reader's own id survives the response.
  it('nulls every actor id except the readers own in a project scope', async () => {
    gate.gateRead.mockResolvedValue(true);
    store.readTimeline.mockResolvedValue({
      items: [
        { id: 'e1', actorId: 'owner-of-doc' },
        { id: 'e2', actorId: 'owner-1' },
        { id: 'e3', actorId: null },
      ],
    });
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:d-1'));
    const body = (await res.json()) as { items: { id: string; actorId: string | null }[] };
    expect(body.items.map((e) => e.actorId)).toEqual([null, 'owner-1', null]);
  });

  it('keeps actor ids in a team scope, read only by its joined members', async () => {
    db.getMembership.mockResolvedValue({ status: 'joined', role: 'member' });
    store.readTimeline.mockResolvedValue({ items: [{ id: 'e1', actorId: 'someone' }] });
    const res = await handleTimeline(
      makeCtx('GET', '/api/timeline?scope=team:t-1', { verifiedUserId: 'owner-1' }),
    );
    const body = (await res.json()) as { items: { actorId: string | null }[] };
    expect(body.items[0]!.actorId).toBe('someone');
  });

  it('403s a project scope the gate refuses', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:d-1'));
    expect(res.status).toBe(403);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  // A refusal, not a 404: a guessed id must not be probeable for
  // existence through this endpoint any more than through the project's.
  it('403s a project scope for an id that does not exist', async () => {
    db.getProject.mockResolvedValue(null);
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:missing'));
    expect(res.status).toBe(403);
    expect(gate.gateRead).not.toHaveBeenCalled();
  });

  // A team feed carries the team's project names and comment text, so
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

  // An invite grants no access to the team's content (docs/specs/013-workspace/teams.md), and its
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

  // A 400 rather than a silent fall back: a client that meant to ask for something else should hear
  // about it.
  it('400s a malformed scope', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=nonsense'));
    expect(res.status).toBe(400);
    expect(store.readTimeline).not.toHaveBeenCalled();
  });

  it('passes the cursor, range, and source-type filters through', async () => {
    gate.gateRead.mockResolvedValue(true);
    await handleTimeline(
      makeCtx(
        'GET',
        '/api/timeline?scope=project:d-1&cursor=100:abc&from=50&to=200&sourceType=project&sourceType=team',
      ),
    );
    expect(store.readTimeline).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cursor: '100:abc',
        from: 50,
        to: 200,
        sourceTypes: ['project', 'team'],
      }),
    );
  });

  // Each filter is a bound parameter, and D1 refuses past 100 of them.
  it('caps the number of source-type filters', async () => {
    gate.gateRead.mockResolvedValue(true);
    const qs = Array.from({ length: 150 }, (_, i) => `sourceType=t${i}`).join('&');
    await handleTimeline(makeCtx('GET', `/api/timeline?scope=project:d-1&${qs}`));
    const opts = store.readTimeline.mock.calls[0]![1] as { sourceTypes: string[] };
    expect(opts.sourceTypes).toHaveLength(20);
  });

  it('caps an oversized limit rather than trusting the client', async () => {
    gate.gateRead.mockResolvedValue(true);
    await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:d-1&limit=99999'));
    expect(store.readTimeline).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 200 }));
  });

  it('falls back to the default page size for a nonsense limit', async () => {
    gate.gateRead.mockResolvedValue(true);
    await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:d-1&limit=-4'));
    expect(store.readTimeline).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 50 }));
  });

  it('returns the page plus the cursor', async () => {
    gate.gateRead.mockResolvedValue(true);
    store.readTimeline.mockResolvedValue({ items: [{ id: 'e1' }], nextCursor: '9:e1' });
    const res = await handleTimeline(makeCtx('GET', '/api/timeline?scope=project:d-1'));
    expect(await res.json()).toEqual({ items: [{ id: 'e1', actorId: null }], nextCursor: '9:e1' });
  });

  // The unread mark belongs to Home (/api/home); a History or Activity read never moves it.
  it('never moves the unread mark', async () => {
    gate.gateRead.mockResolvedValue(true);
    const ctx = makeCtx('GET', '/api/timeline?scope=project:d-1');
    const scheduled: Promise<unknown>[] = [];
    ctx.waitUntil = (p) => scheduled.push(p);
    await handleTimeline(ctx);
    await Promise.all(scheduled);
    expect(scheduled).toHaveLength(0);
    expect(store.getScopeState).not.toHaveBeenCalled();
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
  it('reports nothing when the reader has never opened Home', async () => {
    store.getScopeState.mockResolvedValue({ lastSeenAt: null });
    const res = await handleTimeline(makeCtx('GET', '/api/timeline/unread'));
    expect(await res.json()).toEqual({ count: 0 });
    expect(store.countUnseen).not.toHaveBeenCalled();
  });

  it('400s with no owner', async () => {
    const res = await handleTimeline(makeCtx('GET', '/api/timeline/unread', { owner: null }));
    expect(res.status).toBe(400);
  });
});

// The personal feed's writes are gone: its refresh and its Remove from Timeline (one card, or a stack).
describe('handleTimeline retired writes', () => {
  it('404s the refresh and the dismissals', async () => {
    expect((await handleTimeline(makeCtx('POST', '/api/timeline/refresh'))).status).toBe(404);
    expect((await handleTimeline(makeCtx('DELETE', '/api/timeline/events/ev-1'))).status).toBe(404);
    expect((await handleTimeline(makeCtx('POST', '/api/timeline/events/dismiss'))).status).toBe(
      404,
    );
  });
});
