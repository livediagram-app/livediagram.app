import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    // The revoke itself is tested in db/api-tokens.test.ts; here it is a seam.
    revokePresentedToken: vi.fn(),
    retractTimelineWarning: vi.fn(),
    getParticipant: vi.fn(),
  },
}));
vi.mock('../db', () => db);
// The account's name is its profile at the accounts Worker (person/profiles.ts).
vi.mock('../person/profiles', () => ({ getParticipant: db.getParticipant }));

import type { RouteContext } from './context';
import { handleTokens } from './tokens';

// Signed-in session context: signed in as 'user_1' unless overridden.
const makeCtx = (
  method: string,
  path: string,
  opts: { accountUserId?: string | null; body?: unknown } = {},
): RouteContext => {
  const accountUserId = opts.accountUserId === undefined ? 'user_1' : opts.accountUserId;
  return makeTestRouteContext(method, path, {
    body: opts.body,
    accountUserId,
    owner: accountUserId,
  });
};

beforeEach(() => {
  for (const fn of Object.values(db)) if (typeof fn === 'function') fn.mockReset();
  db.revokePresentedToken.mockResolvedValue(undefined);
  db.retractTimelineWarning.mockResolvedValue(undefined);
});

// Tokens are made, listed and revoked on liveworkspace.app (liveworkspace/docs/specs/003-accounts/accounts.md "API
// tokens"): this app routes only /api/tokens/current, and touches nothing for anything else.
describe('token management is on liveworkspace.app', () => {
  it('404s every other tokens route', async () => {
    for (const [method, path] of [
      ['GET', '/api/tokens'],
      ['POST', '/api/tokens'],
      ['DELETE', '/api/tokens/tok_1'],
      ['GET', '/api/tokens/a/b'],
      ['GET', '/api/other'],
    ] as const) {
      const res = await handleTokens(makeCtx(method, path, { accountUserId: 'user_1' }));
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect(db.revokePresentedToken).not.toHaveBeenCalled();
  });
});

describe('/api/tokens/current (docs/specs/015-api/blueprints/cli.md "Token self-service")', () => {
  const tokenCtx = (method: string, readOnly = false, waitUntil?: (p: Promise<unknown>) => void) =>
    makeTestRouteContext(method, '/api/tokens/current', {
      accountUserId: null,
      owner: 'user_1',
      token: { id: 'tok_1', readOnly, name: 'liveplanner CLI', expiresAt: 99 },
      headers: { Authorization: 'Bearer lwt_secret' },
      ...(waitUntil ? { waitUntil } : {}),
    });

  it('reads the token the request presented, its account and role', async () => {
    db.getParticipant.mockResolvedValue({ id: 'user_1', name: 'Webber' });
    const res = await handleTokens(tokenCtx('GET', true));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      accountId: 'user_1',
      accountName: 'Webber',
      tokenId: 'tok_1',
      tokenName: 'liveplanner CLI',
      role: 'read-only',
      expiresAt: 99,
    });
    db.getParticipant.mockResolvedValue(null);
    expect(
      await (await handleTokens(tokenCtx('GET'))).json<{ accountName: null; role: string }>(),
    ).toMatchObject({
      accountName: null,
      role: 'full',
    });
  });

  // Its workbench pairings end at liveworkspace with the revoke (liveworkspace/docs/specs/011-workbench/workbench.md).
  it('revokes itself at liveworkspace', async () => {
    const work: Promise<unknown>[] = [];
    const res = await handleTokens(tokenCtx('DELETE', false, (p) => void work.push(p)));
    expect(res.status).toBe(204);
    expect(db.revokePresentedToken).toHaveBeenCalledWith(expect.anything(), 'lwt_secret');
    await Promise.all(work);
  });

  it('revokes without a bearer to pass on, and reads a token with no name', async () => {
    const ctx = makeTestRouteContext('DELETE', '/api/tokens/current', {
      accountUserId: null,
      owner: 'user_1',
      token: { id: 'tok_1', expiresAt: 99 },
    });
    expect((await handleTokens(ctx)).status).toBe(204);
    expect(db.revokePresentedToken).not.toHaveBeenCalled();
    const read = makeTestRouteContext('GET', '/api/tokens/current', {
      accountUserId: null,
      owner: 'user_1',
      token: { id: 'tok_1', expiresAt: 99 },
    });
    expect(await (await handleTokens(read)).json()).toMatchObject({ tokenName: null });
  });

  it('answers not_a_token to a session, a guest, or a revoked token, and refuses other methods', async () => {
    const session = await handleTokens(makeCtx('GET', '/api/tokens/current'));
    expect(session.status).toBe(403);
    expect(await session.json()).toEqual({ error: 'not_a_token' });
    const guest = makeTestRouteContext('GET', '/api/tokens/current', {
      accountUserId: null,
      owner: null,
      token: { id: 'tok_1' },
    });
    expect((await handleTokens(guest)).status).toBe(403);
    // A token liveworkspace described without an expiry is no token this route can answer for.
    const undescribed = makeTestRouteContext('GET', '/api/tokens/current', {
      accountUserId: null,
      owner: 'user_1',
      token: { id: 'tok_1' },
    });
    expect((await handleTokens(undescribed)).status).toBe(404);
    expect((await handleTokens(tokenCtx('POST'))).status).toBe(405);
  });
});
