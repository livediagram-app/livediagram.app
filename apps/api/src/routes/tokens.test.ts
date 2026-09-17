import { makeTestRouteContext } from './test-route-context';
import { MAX_NAME_LEN } from '../limits';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    listApiTokensByOwner: vi.fn(),
    // The mint itself is tested in db/api-tokens.test.ts, against a D1 stub.
    // Here it is a seam: these tests are about what the ROUTE does with its
    // two answers — a minted token, or null at the cap.
    mintApiToken: vi.fn(),
    revokeApiToken: vi.fn(),
    retractTimelineWarning: vi.fn(),
  },
}));
vi.mock('../db', () => db);

const { timeline } = vi.hoisted(() => ({
  timeline: { recordTokenCreated: vi.fn(), recordTokenRevoked: vi.fn() },
}));
vi.mock('../timeline', () => timeline);

import type { RouteContext } from './context';
import { handleTokens } from './tokens';

// Clerk-session context: signed in as 'user_1' unless overridden.
const makeCtx = (
  method: string,
  path: string,
  opts: { clerkUserId?: string | null; body?: unknown } = {},
): RouteContext => {
  const clerkUserId = opts.clerkUserId === undefined ? 'user_1' : opts.clerkUserId;
  return makeTestRouteContext(method, path, { body: opts.body, clerkUserId, owner: clerkUserId });
};

beforeEach(() => {
  for (const fn of Object.values(db)) if (typeof fn === 'function') fn.mockReset();
  db.mintApiToken.mockResolvedValue({ secret: 'lvd_x', id: 'tok_x', expiresAt: 1 });
  db.listApiTokensByOwner.mockResolvedValue([]);
  db.revokeApiToken.mockResolvedValue(true);
  db.retractTimelineWarning.mockResolvedValue(undefined);
  for (const fn of Object.values(timeline)) fn.mockReset();
});

// Collects what the route hands to waitUntil so a test can await the
// background work instead of racing it.
function withBackgroundWork(
  method: string,
  path: string,
  opts: { clerkUserId?: string | null; body?: unknown } = {},
) {
  const dispatched: Promise<unknown>[] = [];
  const clerkUserId = opts.clerkUserId === undefined ? 'user_1' : opts.clerkUserId;
  const ctx = makeTestRouteContext(method, path, {
    body: opts.body,
    clerkUserId,
    owner: clerkUserId,
    waitUntil: (p) => {
      dispatched.push(p);
    },
  });
  return { ctx, settled: () => Promise.all(dispatched) };
}

describe('handleTokens — signed-in gate', () => {
  it('403s a guest (no Clerk identity) on GET', async () => {
    const res = await handleTokens(makeCtx('GET', '/api/tokens', { clerkUserId: null }));
    expect(res.status).toBe(403);
  });
  it('403s a guest on POST (no token minted)', async () => {
    const res = await handleTokens(makeCtx('POST', '/api/tokens', { clerkUserId: null, body: {} }));
    expect(res.status).toBe(403);
    expect(db.mintApiToken).not.toHaveBeenCalled();
  });
});

describe('handleTokens — list / create / revoke', () => {
  it('lists the caller-owned tokens', async () => {
    db.listApiTokensByOwner.mockResolvedValue([{ id: 't1' }]);
    const res = await handleTokens(makeCtx('GET', '/api/tokens'));
    expect(res.status).toBe(200);
    expect(db.listApiTokensByOwner).toHaveBeenCalledWith({}, 'user_1');
  });

  it('mints a token and returns the secret once', async () => {
    db.mintApiToken.mockResolvedValue({ secret: 'lvd_abc', id: 'tok_1', expiresAt: 123 });
    const res = await handleTokens(makeCtx('POST', '/api/tokens', { body: { name: 'CI' } }));
    expect(res.status).toBe(201);
    const out = (await res.json()) as { token: string; id: string };
    expect(out.token).toBe('lvd_abc');
    expect(out.id).toBe('tok_1');
    // The route mints for the CALLER, under the name they gave.
    expect(db.mintApiToken).toHaveBeenCalledWith({}, { ownerId: 'user_1', name: 'CI' });
  });

  it('409s when the mint refuses at the per-account cap', async () => {
    db.mintApiToken.mockResolvedValue(null);
    const res = await handleTokens(makeCtx('POST', '/api/tokens', { body: {} }));
    expect(res.status).toBe(409);
    expect((await res.json()) as { error: string }).toEqual({ error: 'token_limit_reached' });
  });

  it('revokes a token (204), 404 when nothing was flipped', async () => {
    const ok = await handleTokens(makeCtx('DELETE', '/api/tokens/t1'));
    expect(ok.status).toBe(204);
    expect(db.revokeApiToken).toHaveBeenCalledWith({}, 'user_1', 't1');
    db.revokeApiToken.mockResolvedValue(false);
    const miss = await handleTokens(makeCtx('DELETE', '/api/tokens/nope'));
    expect(miss.status).toBe(404);
  });

  it('withdraws the pending expiry warning before it says the token is gone', async () => {
    // Order is the point: the countdown row has to go first, or the feed reads
    // "revoked" next to "expires in three days" for the same token.
    db.listApiTokensByOwner.mockResolvedValue([{ id: 't1', name: 'CI' }]);
    const { ctx, settled } = withBackgroundWork('DELETE', '/api/tokens/t1');
    const res = await handleTokens(ctx);
    await settled();
    expect(res.status).toBe(204);
    expect(db.retractTimelineWarning).toHaveBeenCalledWith({}, 'account', 't1', 'token_expiring');
    expect(timeline.recordTokenRevoked).toHaveBeenCalledWith(
      {},
      { id: 't1', name: 'CI' },
      'user_1',
    );
    expect(db.retractTimelineWarning.mock.invocationCallOrder[0]).toBeLessThan(
      timeline.recordTokenRevoked.mock.invocationCallOrder[0]!,
    );
  });

  it('names an unnamed token in the feed rather than leaving a blank', async () => {
    db.listApiTokensByOwner.mockResolvedValue([{ id: 't1', name: null }]);
    const { ctx, settled } = withBackgroundWork('DELETE', '/api/tokens/t1');
    await handleTokens(ctx);
    await settled();
    expect(timeline.recordTokenRevoked).toHaveBeenCalledWith(
      {},
      { id: 't1', name: 'API token' },
      'user_1',
    );
  });

  it('records nothing when the revoke flipped nothing', async () => {
    db.revokeApiToken.mockResolvedValue(false);
    const { ctx, settled } = withBackgroundWork('DELETE', '/api/tokens/t1');
    expect((await handleTokens(ctx)).status).toBe(404);
    await settled();
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
    expect(timeline.recordTokenRevoked).not.toHaveBeenCalled();
  });

  it('404s anything the surface does not route', async () => {
    // A DELETE at the collection, a PUT at an item, a deeper path: none of
    // them are token operations, and none may fall through to another handler.
    for (const [method, path] of [
      ['DELETE', '/api/tokens'],
      ['PUT', '/api/tokens/t1'],
      ['DELETE', '/api/tokens/t1/extra'],
      ['GET', '/api/teams'],
    ] as const) {
      const res = await handleTokens(makeCtx(method, path));
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });
});

describe('POST /api/tokens — the name the caller asks for', () => {
  it('mints an unnamed token when the request carries no readable body', async () => {
    // A POST with no body at all is the shortest path to a token; it must not
    // 500 on the JSON parse.
    const res = await handleTokens(makeCtx('POST', '/api/tokens'));
    expect(res.status).toBe(201);
    expect(db.mintApiToken).toHaveBeenCalledWith({}, { ownerId: 'user_1', name: null });
    expect(await res.json()).toMatchObject({ name: null });
  });

  it('refuses a name past the limit, and mints nothing', async () => {
    const res = await handleTokens(
      makeCtx('POST', '/api/tokens', { body: { name: 'x'.repeat(MAX_NAME_LEN + 1) } }),
    );
    expect(res.status).toBe(400);
    expect(db.mintApiToken).not.toHaveBeenCalled();
  });

  it('trims the name, and treats a whitespace-only one as unnamed', async () => {
    await handleTokens(makeCtx('POST', '/api/tokens', { body: { name: '  CI  ' } }));
    expect(db.mintApiToken).toHaveBeenCalledWith({}, { ownerId: 'user_1', name: 'CI' });
    db.mintApiToken.mockClear();
    await handleTokens(makeCtx('POST', '/api/tokens', { body: { name: '   ' } }));
    expect(db.mintApiToken).toHaveBeenCalledWith({}, { ownerId: 'user_1', name: null });
  });

  it('ignores a name that isn’t a string', async () => {
    await handleTokens(makeCtx('POST', '/api/tokens', { body: { name: 42 } }));
    expect(db.mintApiToken).toHaveBeenCalledWith({}, { ownerId: 'user_1', name: null });
  });

  it('gives the feed a readable label for an unnamed token', async () => {
    const { ctx, settled } = withBackgroundWork('POST', '/api/tokens', { body: {} });
    await handleTokens(ctx);
    await settled();
    expect(timeline.recordTokenCreated).toHaveBeenCalledWith(
      {},
      { id: 'tok_x', name: 'API token' },
      'user_1',
    );
  });
});
