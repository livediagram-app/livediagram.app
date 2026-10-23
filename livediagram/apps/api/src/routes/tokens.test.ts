import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    listApiTokensByOwner: vi.fn(),
    // The revoke itself is tested in db/api-tokens.test.ts; here it is a seam.
    revokePresentedToken: vi.fn(),
    retractTimelineWarning: vi.fn(),
    getParticipant: vi.fn(),
  },
}));
vi.mock('../db', () => db);
vi.mock('../liveworkspace/profiles', () => ({ getParticipant: db.getParticipant }));

const { timeline } = vi.hoisted(() => ({
  timeline: { recordTokenRevoked: vi.fn() },
}));
vi.mock('../timeline', () => timeline);

const { workbenchEnd } = vi.hoisted(() => ({ workbenchEnd: { endWorkbenchAccess: vi.fn() } }));
vi.mock('../workbench-end', () => workbenchEnd);

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
  db.listApiTokensByOwner.mockResolvedValue([]);
  db.revokePresentedToken.mockResolvedValue(undefined);
  db.retractTimelineWarning.mockResolvedValue(undefined);
  for (const fn of Object.values(timeline)) fn.mockReset();
  workbenchEnd.endWorkbenchAccess.mockReset();
});

// Tokens are made, listed and revoked on liveworkspace.app (liveworkspace/docs/accounts.md "API
// tokens"): the management routes say where, for anyone, and touch nothing.
describe('token management is on liveworkspace.app', () => {
  it('answers 410 with where to manage tokens', async () => {
    for (const [method, path, accountUserId] of [
      ['GET', '/api/tokens', 'user_1'],
      ['POST', '/api/tokens', 'user_1'],
      ['DELETE', '/api/tokens/tok_1', 'user_1'],
      ['GET', '/api/tokens', null],
    ] as const) {
      const res = await handleTokens(makeCtx(method, path, { accountUserId }));
      expect(res.status, `${method} ${path}`).toBe(410);
      expect(await res.json()).toEqual({
        error: 'tokens_moved',
        manageAt: 'https://liveworkspace.app/account/tokens',
      });
    }
    expect(db.revokePresentedToken).not.toHaveBeenCalled();
  });

  it('404s anything the surface does not route', async () => {
    expect((await handleTokens(makeCtx('GET', '/api/tokens/a/b'))).status).toBe(404);
    expect((await handleTokens(makeCtx('GET', '/api/other'))).status).toBe(404);
  });
});

describe('/api/tokens/current (docs/specs/015-api/blueprints/cli.md "Token self-service")', () => {
  const live = {
    id: 'tok_1',
    name: 'livediagram CLI',
    expiresAt: 99,
    createdAt: 1,
    lastUsedAt: null,
  };
  const tokenCtx = (method: string, readOnly = false, waitUntil?: (p: Promise<unknown>) => void) =>
    makeTestRouteContext(method, '/api/tokens/current', {
      accountUserId: null,
      owner: 'user_1',
      token: { id: 'tok_1', readOnly },
      headers: { Authorization: 'Bearer lwt_secret' },
      ...(waitUntil ? { waitUntil } : {}),
    });

  it('reads the token the request presented, its account and role', async () => {
    db.listApiTokensByOwner.mockResolvedValue([live]);
    db.getParticipant.mockResolvedValue({ id: 'user_1', name: 'Webber' });
    const res = await handleTokens(tokenCtx('GET', true));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      accountId: 'user_1',
      accountName: 'Webber',
      tokenId: 'tok_1',
      tokenName: 'livediagram CLI',
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

  it('revokes itself, recording it', async () => {
    db.listApiTokensByOwner.mockResolvedValue([live]);
    const work: Promise<unknown>[] = [];
    const res = await handleTokens(tokenCtx('DELETE', false, (p) => void work.push(p)));
    expect(res.status).toBe(204);
    expect(db.revokePresentedToken).toHaveBeenCalledWith(expect.anything(), {
      id: 'tok_1',
      secret: 'lwt_secret',
    });
    expect(workbenchEnd.endWorkbenchAccess).toHaveBeenCalledWith(
      expect.anything(),
      { tokenId: 'tok_1' },
      'revoked',
    );
    await Promise.all(work);
    expect(timeline.recordTokenRevoked).toHaveBeenCalled();
    db.listApiTokensByOwner.mockResolvedValue([{ ...live, name: null }]);
    await handleTokens(tokenCtx('DELETE', false, (p) => void work.push(p)));
    await Promise.all(work);
    expect(timeline.recordTokenRevoked).toHaveBeenLastCalledWith(
      expect.anything(),
      { id: 'tok_1', name: 'API token' },
      'user_1',
    );
  });

  it('still ends its workbench access when no bearer secret came with it', async () => {
    db.listApiTokensByOwner.mockResolvedValue([live]);
    const res = await handleTokens(
      makeTestRouteContext('DELETE', '/api/tokens/current', {
        accountUserId: null,
        owner: 'user_1',
        token: { id: 'tok_1', readOnly: false },
      }),
    );
    expect(res.status).toBe(204);
    expect(db.revokePresentedToken).not.toHaveBeenCalled();
    expect(workbenchEnd.endWorkbenchAccess).toHaveBeenCalledWith(
      expect.anything(),
      { tokenId: 'tok_1' },
      'revoked',
    );
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
    db.listApiTokensByOwner.mockResolvedValue([]);
    expect((await handleTokens(tokenCtx('GET'))).status).toBe(404);
    db.listApiTokensByOwner.mockResolvedValue([live]);
    expect((await handleTokens(tokenCtx('POST'))).status).toBe(405);
  });
});
