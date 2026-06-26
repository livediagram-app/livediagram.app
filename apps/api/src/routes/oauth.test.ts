import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    createApiToken: vi.fn(),
    countLiveApiTokens: vi.fn(),
    MAX_API_TOKENS_PER_OWNER: 10,
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleOauthExchange } from './oauth';

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
    clerkEmail: null,
    resolveOwner: () => clerkUserId,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) if (typeof fn === 'function') fn.mockReset();
  db.countLiveApiTokens.mockResolvedValue(0);
});

describe('handleOauthExchange — signed-in gate', () => {
  it('403s a guest (no Clerk identity), minting nothing', async () => {
    const res = await handleOauthExchange(
      makeCtx('POST', '/api/oauth/exchange', { clerkUserId: null, body: {} }),
    );
    expect(res.status).toBe(403);
    expect(db.createApiToken).not.toHaveBeenCalled();
  });
});

describe('handleOauthExchange — mint', () => {
  it('mints a client-named lvd_ token and returns the secret once', async () => {
    const res = await handleOauthExchange(
      makeCtx('POST', '/api/oauth/exchange', { body: { clientName: 'Claude (MCP)' } }),
    );
    expect(res.status).toBe(201);
    const out = (await res.json()) as { token: string; id: string; name: string };
    expect(out.token.startsWith('lvd_')).toBe(true);
    expect(out.name).toBe('Claude (MCP)');
    const arg = db.createApiToken.mock.calls[0]![1] as { ownerId: string; tokenHash: string };
    expect(arg.ownerId).toBe('user_1');
    expect(arg.tokenHash).not.toContain(out.token); // hash stored, not plaintext
  });

  it('defaults the name when the client sent none', async () => {
    const res = await handleOauthExchange(makeCtx('POST', '/api/oauth/exchange', { body: {} }));
    const out = (await res.json()) as { name: string };
    expect(out.name).toBe('MCP client');
  });

  it('409s at the per-account token cap', async () => {
    db.countLiveApiTokens.mockResolvedValue(10);
    const res = await handleOauthExchange(makeCtx('POST', '/api/oauth/exchange', { body: {} }));
    expect(res.status).toBe(409);
    expect(db.createApiToken).not.toHaveBeenCalled();
  });

  it('404s a non-exchange path or non-POST', async () => {
    expect((await handleOauthExchange(makeCtx('GET', '/api/oauth/exchange'))).status).toBe(404);
    expect(
      (await handleOauthExchange(makeCtx('POST', '/api/oauth/other', { body: {} }))).status,
    ).toBe(404);
  });
});
