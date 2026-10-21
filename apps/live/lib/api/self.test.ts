import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiLoadSelf,
  apiMintGuestId,
  apiSaveSelf,
  MINT_RETRIES,
  MINT_RETRY_MAX_WAIT_MS,
} from './self';

// /new hands the new document to the editor in place (docs/specs/007-editor/new-document-route.md), and
// both load the participant: the editor must reuse the one /new just read and saved rather than
// asking the server again on every new document.

describe('the participant the page already knows', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
        const participant = { id: 'p-1', name: 'Swift Otter', color: '#0ea5e9' };
        return Promise.resolve(new Response(JSON.stringify({ participant }), { status: 200 }));
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('answers a load straight after a save without a request', async () => {
    await apiSaveSelf({ id: 'p-save', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    const self = await apiLoadSelf('p-save');
    expect(self?.name).toBe('Brave Heron');
    expect(calls.filter((c) => c.startsWith('GET'))).toEqual([]);
  });

  it('asks the server for a participant it has not seen', async () => {
    await apiSaveSelf({ id: 'p-save-2', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    await apiLoadSelf('p-other');
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(1);
  });

  it('asks again once the handoff window has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await apiSaveSelf({ id: 'p-old', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    vi.setSystemTime(Date.now() + 31_000);
    await apiLoadSelf('p-old');
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(1);
  });
});

// docs/specs/015-api/api.md: the api answers the caller's own absent profile with { participant: null },
// which it can only tell when the load says who is asking.
describe('loading your own profile before you have saved one', () => {
  let requests: { url: string; headers: Headers }[];

  beforeEach(() => {
    requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        requests.push({ url: String(url), headers: new Headers(init?.headers) });
        return Promise.resolve(
          new Response(JSON.stringify({ participant: null }), { status: 200 }),
        );
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks as yourself and reads no profile as null', async () => {
    expect(await apiLoadSelf('p-fresh')).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers.get('X-Owner-Id')).toBe('p-fresh');
  });

  it('still loads a signed-in profile, anonymously, while the session token is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const participant = { id: 'user_ann', name: 'Ann', color: '#f00', createdAt: 1 };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        requests.push({ url: String(url), headers: new Headers(init?.headers) });
        return Promise.resolve(new Response(JSON.stringify({ participant }), { status: 200 }));
      }),
    );
    expect((await apiLoadSelf('user_ann'))?.name).toBe('Ann');
    expect(requests[0]!.headers.get('X-Owner-Id')).toBeNull();
    expect(requests[0]!.headers.get('Authorization')).toBeNull();
  });
});

// docs/specs/014-identity/auth-and-guest-access.md "Server-minted": the mint is limited per network, and a
// first visit on a busy shared address waits and tries again rather than giving up.
describe('minting a guest id on a busy network', () => {
  const MINTED = { ownerId: 'g-1', ownerSig: 'sig' };
  const busy = (retryAfter: string | null) =>
    new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: retryAfter === null ? {} : { 'Retry-After': retryAfter },
    });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function answers(...responses: Response[]) {
    const fetch = vi.fn(() => Promise.resolve(responses.shift()!));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('waits the Retry-After and mints on the next try', async () => {
    vi.useFakeTimers();
    const fetch = answers(busy('3'), new Response(JSON.stringify(MINTED), { status: 200 }));
    const minted = apiMintGuestId();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await minted).toEqual(MINTED);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('never waits longer than the cap, whatever Retry-After says', async () => {
    vi.useFakeTimers();
    const fetch = answers(busy('600'), new Response(JSON.stringify(MINTED), { status: 200 }));
    const minted = apiMintGuestId();
    await vi.advanceTimersByTimeAsync(MINT_RETRY_MAX_WAIT_MS);
    expect(await minted).toEqual(MINTED);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back (null) after its retries are spent', async () => {
    vi.useFakeTimers();
    const fetch = answers(busy(null), busy(null), busy(null));
    const minted = apiMintGuestId();
    await vi.advanceTimersByTimeAsync(MINT_RETRIES * MINT_RETRY_MAX_WAIT_MS);
    expect(await minted).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1 + MINT_RETRIES);
  });

  it('does not retry any other failure', async () => {
    const fetch = answers(new Response('{}', { status: 500 }));
    expect(await apiMintGuestId()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
