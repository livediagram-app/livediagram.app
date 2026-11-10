import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiCreateRoomTicket } from './designs';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "A ticket mint that gets no answer opens no socket":
// a refusal answers null, so the connector's refusal path runs; no answer at all throws, so it backs off instead.
describe('apiCreateRoomTicket', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function answer(response: () => Response | Promise<Response>) {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      seen.push(String(url instanceof Request ? url.url : url));
      return response();
    });
    return seen;
  }

  async function settle<T>(promise: Promise<T>): Promise<T> {
    // Caught at once, so a rejection is never unhandled while the retry waits run.
    const result = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    const out = await result;
    if ('error' in out) throw out.error;
    return out.value;
  }

  it('answers the ticket the api mints', async () => {
    const seen = answer(() => Response.json({ ticket: 't1' }));
    expect(await settle(apiCreateRoomTicket('owner', 'd1'))).toEqual({ ticket: 't1' });
    expect(seen[0]).toMatch(/\/designs\/d1\/room-ticket$/);
  });

  it('is null at once when the api refuses', async () => {
    const seen = answer(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    expect(await settle(apiCreateRoomTicket('owner', 'd1'))).toBeNull();
    expect(seen).toHaveLength(1);
  });

  it('throws after its tries when no request gets an answer', async () => {
    const seen = answer(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(settle(apiCreateRoomTicket('owner', 'd1'))).rejects.toThrow(
      'room ticket mint unreachable',
    );
    expect(seen).toHaveLength(3);
  });

  it('throws when every try is answered 503', async () => {
    answer(() => Response.json({ error: 'storage_unavailable' }, { status: 503 }));
    await expect(settle(apiCreateRoomTicket('owner', 'd1'))).rejects.toThrow(
      'room ticket mint unreachable',
    );
  });
});
