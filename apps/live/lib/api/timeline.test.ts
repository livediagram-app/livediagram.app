import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiListTimeline } from './timeline';

// The regression these lock (spec/138 §2.4 / §6.4): a read that FAILED
// used to come back as an empty page, indistinguishable from a feed
// with nothing in it. The Timeline then rendered "Nothing has happened
// yet" at people whose history was intact on the server, and only a
// browser refresh proved otherwise. Null is the third answer.

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('apiListTimeline', () => {
  beforeEach(() => {
    stubFetch(() => Promise.resolve(new Response('{"items":[]}', { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the page on a successful read', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [{ id: 'e1', occurredAt: 5 }],
            nextCursor: '5:e1',
            lastSeenAt: 4,
          }),
          { status: 200 },
        ),
      ),
    );
    const page = await apiListTimeline('owner-1');
    expect(page?.events).toHaveLength(1);
    expect(page?.nextCursor).toBe('5:e1');
    expect(page?.lastSeenAt).toBe(4);
  });

  it('distinguishes a genuinely empty feed from a failure', async () => {
    const page = await apiListTimeline('owner-1');
    expect(page).toEqual({ events: [], nextCursor: undefined, lastSeenAt: undefined });
  });

  it('returns null when the worker refuses the read', async () => {
    // A lapsed session token is the one that bit: the owner is fine,
    // the credential isn't, and the feed is emphatically not empty.
    stubFetch(() => Promise.resolve(new Response('{"error":"missing_auth"}', { status: 401 })));
    await expect(apiListTimeline('owner-1')).resolves.toBeNull();
  });

  it('returns null when the worker errors', async () => {
    stubFetch(() => Promise.resolve(new Response('', { status: 500 })));
    await expect(apiListTimeline('owner-1')).resolves.toBeNull();
  });

  it('returns null when the fetch throws (offline)', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiListTimeline('owner-1')).resolves.toBeNull();
  });

  it('returns null on a body that is not JSON', async () => {
    stubFetch(() => Promise.resolve(new Response('<!doctype html>', { status: 200 })));
    await expect(apiListTimeline('owner-1')).resolves.toBeNull();
  });
});
