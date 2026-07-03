import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    listApiTokensByOwner: vi.fn(),
    createApiToken: vi.fn(),
    countLiveApiTokens: vi.fn(),
    revokeApiToken: vi.fn(),
    MAX_API_TOKENS_PER_OWNER: 10,
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleTokens } from './tokens';

function makeCtx(
  method: string,
  path: string,
  opts: { clerkUserId?: string | null; body?: unknown } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const clerkUserId = opts.clerkUserId === undefined ? 'user_1' : opts.clerkUserId;
  return {
    request,
    env: {} as Env,
    url,
    segments,
    clerkUserId,
    verifiedUserId: clerkUserId,
    clerkEmail: null,
    resolveOwner: () => clerkUserId,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) if (typeof fn === 'function') fn.mockReset();
  db.countLiveApiTokens.mockResolvedValue(0);
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
    expect(db.createApiToken).not.toHaveBeenCalled();
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
    const res = await handleTokens(makeCtx('POST', '/api/tokens', { body: { name: 'CI' } }));
    expect(res.status).toBe(201);
    const out = (await res.json()) as { token: string; id: string };
    expect(out.token.startsWith('lvd_')).toBe(true);
    expect(out.id).toBeTruthy();
    expect(db.createApiToken).toHaveBeenCalledTimes(1);
    // The stored row carries a hash, never the plaintext.
    const arg = db.createApiToken.mock.calls[0]![1] as { tokenHash: string; ownerId: string };
    expect(arg.ownerId).toBe('user_1');
    expect(arg.tokenHash).not.toContain(out.token);
  });

  it('409s when the per-account cap is reached', async () => {
    db.countLiveApiTokens.mockResolvedValue(10);
    const res = await handleTokens(makeCtx('POST', '/api/tokens', { body: {} }));
    expect(res.status).toBe(409);
    expect(db.createApiToken).not.toHaveBeenCalled();
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
