import { afterEach, describe, expect, it, vi } from 'vitest';
import { askToken, askTokenUntilKnown, type TokenAnswer } from './token-answer';

// liveworkspace/docs/specs/003-accounts/accounts.md "An answer that never came".

const respond = (status: number, body: unknown) =>
  vi.fn(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );

afterEach(() => vi.useRealTimers());

describe('askToken', () => {
  it('reads a signed-in answer, with the token age when the api gives one', async () => {
    const fetch = respond(200, {
      signedIn: true,
      accessToken: 'at',
      expiresAt: 5,
      user: { id: 'user_1' },
      tokenAgeMs: 30,
    });
    expect(await askToken('/api', { fetch })).toEqual({
      kind: 'signed-in',
      session: { accessToken: 'at', expiresAt: 5, user: { id: 'user_1' }, tokenAgeMs: 30 },
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/token',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    const noAge = respond(200, { signedIn: true, accessToken: 'at', user: { id: 'user_1' } });
    expect(await askToken('/api', { fetch: noAge })).toEqual({
      kind: 'signed-in',
      session: { accessToken: 'at', expiresAt: 0, user: { id: 'user_1' } },
    });
  });

  it("asks with the page's own fetch by default", async () => {
    const fetch = respond(401, { signedIn: false });
    vi.stubGlobal('fetch', fetch);
    try {
      expect(await askToken('/api')).toEqual({ kind: 'signed-out' });
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("is signed out only on the api's own word", async () => {
    expect(await askToken('/api', { fetch: respond(401, { signedIn: false }) })).toEqual({
      kind: 'signed-out',
    });
    expect(await askToken('/api', { fetch: respond(200, { signedIn: false }) })).toEqual({
      kind: 'signed-out',
    });
  });

  it.each([
    ['a 5xx', respond(503, { signedIn: false }), 'status 503'],
    ['a 401 that is not the answer', respond(401, 'Unauthorized'), 'status 401'],
    ['a signed-in answer with no token', respond(200, { signedIn: true }), 'status 200'],
    ['a 429', respond(429, {}), 'status 429'],
  ])('reads %s as unknown', async (_what, fetch, reason) => {
    expect(await askToken('/api', { fetch })).toEqual({ kind: 'unknown', reason });
  });

  it('reads a failed request as unknown', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await askToken('/api', { fetch })).toEqual({ kind: 'unknown', reason: 'TypeError' });
    const odd = vi.fn(async () => {
      throw 'odd';
    });
    expect(await askToken('/api', { fetch: odd })).toEqual({ kind: 'unknown', reason: 'error' });
  });

  // The Thomas HQ open: the api's refresh stalled upstream and the token request never answered.
  it('gives up on a request that never answers, as unknown', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const answer = askToken('/api', {
      fetch: fetch as unknown as typeof globalThis.fetch,
      timeoutMs: 50,
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(await answer).toEqual({ kind: 'unknown', reason: 'timeout' });
  });
});

describe('askTokenUntilKnown', () => {
  it('asks again while the answer is unknown, waiting longer each time up to the last wait', async () => {
    const answers: TokenAnswer<string>[] = [
      { kind: 'unknown', reason: 'timeout' },
      { kind: 'unknown', reason: 'status 503' },
      { kind: 'unknown', reason: 'timeout' },
      { kind: 'signed-in', session: 's' },
    ];
    const waits: number[] = [];
    const onUnknown = vi.fn();
    const answer = await askTokenUntilKnown(async () => answers.shift()!, {
      delays: [10, 20],
      wait: async (ms) => {
        waits.push(ms);
      },
      onUnknown,
    });
    expect(answer).toEqual({ kind: 'signed-in', session: 's' });
    expect(waits).toEqual([10, 20, 20]);
    expect(onUnknown).toHaveBeenNthCalledWith(2, 'status 503', 1);
  });

  it('settles on signed out at once, and waits with its own timer by default', async () => {
    expect(await askTokenUntilKnown(async () => ({ kind: 'signed-out' }))).toEqual({
      kind: 'signed-out',
    });
    vi.useFakeTimers();
    let n = 0;
    const answer = askTokenUntilKnown<string>(async () =>
      n++ === 0 ? { kind: 'unknown', reason: 'timeout' } : { kind: 'signed-out' },
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await answer).toEqual({ kind: 'signed-out' });
  });
});
