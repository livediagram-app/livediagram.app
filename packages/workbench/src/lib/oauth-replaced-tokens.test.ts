// A reconnect's replaced token, and the order the token cap's list reads in (docs/specs/015-api/mcp-server.md
// "Consent + mint"): only the ids the MCP named, still live, with the new token's name, and only once the new token
// is live itself.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsRequest } from '@liveworkspace/settings-ui/token-list';
import {
  accountTokensRequest,
  leastRecentlyUsedFirst,
  replacedIds,
  revokeReplacedTokens,
} from './oauth-replaced-tokens';

const token = (id: string, name: string, lastUsedAt: number | null, createdAt = 0) => ({
  id,
  name,
  readOnly: false,
  createdAt,
  lastUsedAt,
  expiresAt: 9e12,
});

function account(tokens: ReturnType<typeof token>[], listOk = true) {
  const calls: { path: string; method: string; keepalive: boolean }[] = [];
  const request = (async (
    path: string,
    method = 'GET',
    _body?: unknown,
    options?: { keepalive?: boolean },
  ) => {
    calls.push({ path, method, keepalive: options?.keepalive === true });
    if (method === 'DELETE') return { ok: true, data: {} };
    return listOk ? { ok: true, data: { tokens } } : { ok: false, status: 503, error: 'offline' };
  }) as SettingsRequest;
  return { request, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe('replacedIds', () => {
  it('keeps the strings of a list, at most five', () => {
    expect(replacedIds(['a', 7, '', null, 'b'])).toEqual(['a', 'b']);
    expect(replacedIds(['1', '2', '3', '4', '5', '6'])).toEqual(['1', '2', '3', '4', '5']);
  });

  it('reads anything else as none', () => {
    expect(replacedIds(undefined)).toEqual([]);
    expect(replacedIds('a')).toEqual([]);
    expect(replacedIds({ 0: 'a' })).toEqual([]);
  });
});

describe('revokeReplacedTokens', () => {
  it('revokes exactly the earlier token of this client, so it outlives the page', async () => {
    const { request, calls } = account([
      token('new', 'Claude Code', null),
      token('old', 'Claude Code', 5),
      token('script', 'Weekly script', 3),
      token('elsewhere', 'Claude Code', 2),
    ]);
    await revokeReplacedTokens(request, 'new', ['old', 'script', 'revoked-already']);
    expect(calls).toEqual([
      { path: '/tokens', method: 'GET', keepalive: false },
      { path: '/tokens/old', method: 'DELETE', keepalive: true },
    ]);
  });

  it('asks nothing when nothing is replaced', async () => {
    const { request, calls } = account([]);
    await revokeReplacedTokens(request, 'new', []);
    expect(calls).toEqual([]);
  });

  it('revokes nothing while the new token is not live', async () => {
    const { request, calls } = account([token('old', 'Claude Code', 5)]);
    await revokeReplacedTokens(request, 'new', ['old']);
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('throws when the tokens cannot be listed', async () => {
    const { request } = account([], false);
    await expect(revokeReplacedTokens(request, 'new', ['old'])).rejects.toThrow('offline');
  });
});

describe('leastRecentlyUsedFirst', () => {
  it('orders by last use, a token never used by when it was made, and leaves its input be', () => {
    const tokens = [token('recent', 'a', 9), token('never', 'b', null, 2), token('old', 'c', 4)];
    expect(leastRecentlyUsedFirst(tokens).map((t) => t.id)).toEqual(['never', 'old', 'recent']);
    expect(tokens.map((t) => t.id)).toEqual(['recent', 'never', 'old']);
  });
});

describe('accountTokensRequest', () => {
  it('asks the bearer door only with an access token, and says signed out without one', async () => {
    // The workbench binding's default bearer is none.
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await accountTokensRequest()('/tokens')).toEqual({
      ok: false,
      status: 401,
      error: 'signed_out',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
