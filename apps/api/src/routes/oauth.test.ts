import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    // The mint itself is tested in db/api-tokens.test.ts. Here it is a seam:
    // this route's job is the client name, the read-only flag, and the two
    // answers the mint can give.
    mintApiToken: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleOauthExchange } from './oauth';

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
  db.mintApiToken.mockResolvedValue({ secret: 'lvd_abc', id: 'tok_1', expiresAt: 123 });
});

describe('handleOauthExchange — signed-in gate', () => {
  it('403s a guest (no Clerk identity), minting nothing', async () => {
    const res = await handleOauthExchange(
      makeCtx('POST', '/api/oauth/exchange', { clerkUserId: null, body: {} }),
    );
    expect(res.status).toBe(403);
    expect(db.mintApiToken).not.toHaveBeenCalled();
  });
});

describe('handleOauthExchange — mint', () => {
  it('mints a client-named lvd_ token and returns the secret once', async () => {
    const res = await handleOauthExchange(
      makeCtx('POST', '/api/oauth/exchange', { body: { clientName: 'Claude (MCP)' } }),
    );
    expect(res.status).toBe(201);
    const out = (await res.json()) as { token: string; id: string; name: string };
    expect(out.token).toBe('lvd_abc');
    expect(out.name).toBe('Claude (MCP)');
    // Minted for the signed-in owner, under the client's name.
    expect(db.mintApiToken).toHaveBeenCalledWith(
      {},
      { ownerId: 'user_1', name: 'Claude (MCP)', readOnly: false },
    );
  });

  it('defaults the name when the client sent none', async () => {
    const res = await handleOauthExchange(makeCtx('POST', '/api/oauth/exchange', { body: {} }));
    const out = (await res.json()) as { name: string };
    expect(out.name).toBe('MCP client');
  });

  it('409s when the mint refuses at the per-account cap', async () => {
    db.mintApiToken.mockResolvedValue(null);
    const res = await handleOauthExchange(makeCtx('POST', '/api/oauth/exchange', { body: {} }));
    expect(res.status).toBe(409);
    expect((await res.json()) as { error: string }).toEqual({ error: 'token_limit_reached' });
  });

  it('passes the read-only flag through to the mint (spec/62)', async () => {
    await handleOauthExchange(makeCtx('POST', '/api/oauth/exchange', { body: { readOnly: true } }));
    expect(db.mintApiToken).toHaveBeenCalledWith(
      {},
      { ownerId: 'user_1', name: 'MCP client', readOnly: true },
    );
  });

  it('404s a non-exchange path or non-POST', async () => {
    expect((await handleOauthExchange(makeCtx('GET', '/api/oauth/exchange'))).status).toBe(404);
    expect(
      (await handleOauthExchange(makeCtx('POST', '/api/oauth/other', { body: {} }))).status,
    ).toBe(404);
  });
});
