import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    listApiTokensByOwner: vi.fn(),
    // The mint itself is tested in db/api-tokens.test.ts, against a D1 stub.
    // Here it is a seam: these tests are about what the ROUTE does with its
    // two answers — a minted token, or null at the cap.
    mintApiToken: vi.fn(),
    revokeApiToken: vi.fn(),
  },
}));
vi.mock('../db', () => db);

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
});

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
});
