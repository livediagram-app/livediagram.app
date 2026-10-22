import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiListTimeline } from './timeline';

// The regression these lock (docs/specs/013-workspace/timeline.md §2.4 / §6.4): a read that FAILED
// used to come back as an empty page, indistinguishable from a feed
// with nothing in it. A feed then rendered "Nothing has happened
// yet" at people whose history was intact on the server, and only a
// browser refresh proved otherwise. Null is the third answer.

const SCOPE = { scope: { scopeType: 'document', scopeId: 'doc-1' } } as const;

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

  it('asks for the scope it reads', async () => {
    await apiListTimeline('owner-1', SCOPE);
    const url = vi.mocked(fetch).mock.calls[0]![0] as string;
    expect(new URL(url, 'http://x').searchParams.get('scope')).toBe('document:doc-1');
  });

  it('returns the page on a successful read', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [{ id: 'e1', occurredAt: 5 }],
            nextCursor: '5:e1',
          }),
          { status: 200 },
        ),
      ),
    );
    const page = await apiListTimeline('owner-1', SCOPE);
    expect(page?.events).toHaveLength(1);
    expect(page?.nextCursor).toBe('5:e1');
  });

  it('distinguishes a genuinely empty feed from a failure', async () => {
    const page = await apiListTimeline('owner-1', SCOPE);
    expect(page).toEqual({ events: [], nextCursor: undefined });
  });

  it('returns null when the worker refuses the read', async () => {
    // A lapsed session token is the one that bit: the owner is fine,
    // the credential isn't, and the feed is emphatically not empty.
    stubFetch(() => Promise.resolve(new Response('{"error":"missing_auth"}', { status: 401 })));
    await expect(apiListTimeline('owner-1', SCOPE)).resolves.toBeNull();
  });

  it('returns null when the worker errors', async () => {
    stubFetch(() => Promise.resolve(new Response('', { status: 500 })));
    await expect(apiListTimeline('owner-1', SCOPE)).resolves.toBeNull();
  });

  it('returns null when the fetch throws (offline)', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(apiListTimeline('owner-1', SCOPE)).resolves.toBeNull();
  });

  it('returns null on a body that is not JSON', async () => {
    stubFetch(() => Promise.resolve(new Response('<!doctype html>', { status: 200 })));
    await expect(apiListTimeline('owner-1', SCOPE)).resolves.toBeNull();
  });
});
