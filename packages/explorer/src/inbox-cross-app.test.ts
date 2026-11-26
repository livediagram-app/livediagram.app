// Another app's API from an app's Inbox (inbox-reading.md "Cross-app verbs"): the workspace token traded for the
// app's bearer, held until a minute before it runs out, and sent to the other app's API alone.
import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceTokenSource, crossAppInboxApi } from './inbox-cross-app';

const answer = (token: string, expiresAt: number) =>
  Response.json({ token, kind: 'account', sub: 'user_a', expiresAt });

describe('createWorkspaceTokenSource', () => {
  it('trades the bearer once, holds the token, and trades again near its end or for another bearer', async () => {
    let now = 1_000_000;
    let bearer = 'app-a';
    const fetch = vi.fn(async () => answer(`ws-${fetch.mock.calls.length}`, now + 15 * 60_000));
    const token = createWorkspaceTokenSource({
      url: '/api/workspace/account/workspace-token',
      bearer: async () => bearer,
      fetch: fetch as unknown as typeof globalThis.fetch,
      now: () => now,
    });
    // Two callers at once share one trade.
    expect(await Promise.all([token(), token()])).toEqual(['ws-1', 'ws-1']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual([
      '/api/workspace/account/workspace-token',
      { headers: { authorization: 'Bearer app-a' }, credentials: 'omit' },
    ]);
    now += 13 * 60_000;
    expect(await token()).toBe('ws-1');
    now += 2 * 60_000;
    expect(await token()).toBe('ws-2');
    bearer = 'app-b';
    expect(await token()).toBe('ws-3');
  });

  it('answers null with no bearer, on a refusal, and on a malformed or failed answer', async () => {
    const make = (fetch: () => Promise<Response>, bearer: string | null = 'b') =>
      createWorkspaceTokenSource({
        url: '/t',
        bearer: async () => bearer,
        fetch: fetch as unknown as typeof globalThis.fetch,
      });
    const never = vi.fn(async () => answer('x', Date.now() + 600_000));
    expect(await make(never, null)()).toBeNull();
    expect(never).not.toHaveBeenCalled();
    expect(await make(async () => new Response(null, { status: 401 }))()).toBeNull();
    expect(await make(async () => Response.json({ token: 7 }))()).toBeNull();
    expect(
      await make(async () => {
        throw new Error('offline');
      })(),
    ).toBeNull();
  });
});

describe('crossAppInboxApi', () => {
  it('calls the other app’s API by the workspace token, and refuses without one', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const api = crossAppInboxApi(
      'livediagram',
      async () => 'ws',
      fetch as unknown as typeof globalThis.fetch,
    );
    await api('/documents/d1/tabs/t1/comments', { method: 'POST', body: { text: 'Hi' } });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.livediagram.app/api/documents/d1/tabs/t1/comments');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer ws');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(init.body).toBe('{"text":"Hi"}');
    expect(init.credentials).toBe('omit');
    const none = crossAppInboxApi('livediagram', async () => null, fetch as never);
    expect((await none('/documents/d1/comments', { method: 'GET' })).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
