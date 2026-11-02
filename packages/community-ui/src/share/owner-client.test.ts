import { describe, expect, it, vi } from 'vitest';
import { communityErrorMessage } from './community-errors';
import { CommunityRequestError, communityOwnerClient, communityPopularTags } from './owner-client';
import { COMMUNITY_APP_WORDS } from './words';

// The owner's post over plain fetch, as the Explorer on liveworkspace.app reaches an app's owner route.

const URL_ = 'https://www.livediagram.app/api/documents/d1/community';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function client(fetchImpl: typeof fetch, token: string | null = 'tok') {
  return communityOwnerClient({
    app: 'livediagram.app',
    url: URL_,
    token: async () => token,
    serviceBase: 'https://community.test',
    fetch: fetchImpl,
  });
}

describe('communityOwnerClient', () => {
  it('reads the post with the bearer token and no cookies', async () => {
    const doFetch = vi.fn(async () => json({ post: { id: 'p1' } }));
    expect(await client(doFetch).get()).toEqual({ id: 'p1' });
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_);
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('reads none as null, and sends no Authorization without a token', async () => {
    const doFetch = vi.fn(async () => json({}));
    expect(await client(doFetch, null).get()).toBeNull();
    const [, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('publishes with a JSON body, and throws a refusal with its code', async () => {
    const ok = vi.fn(async () => json({ post: { id: 'p2' } }));
    expect(await client(ok).publish({ title: 'T' } as never)).toEqual({ id: 'p2' });
    const [, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ title: 'T' }));

    const refused = vi.fn(async () => json({ error: 'empty_document' }, 409));
    const err = await client(refused)
      .publish({} as never)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CommunityRequestError);
    expect(err).toMatchObject({ status: 409, code: 'empty_document' });
    expect(communityErrorMessage(err, COMMUNITY_APP_WORDS['livediagram.app'])).toMatch(/first tab/);
  });

  it('counts a post already gone as removed, and throws any other refusal', async () => {
    await expect(client(vi.fn(async () => json({}, 404))).remove()).resolves.toBeUndefined();
    await expect(
      client(vi.fn(async () => new Response('nope', { status: 500 }))).remove(),
    ).rejects.toMatchObject({ status: 500, code: null });
    await expect(client(vi.fn(async () => json({}, 403))).get()).rejects.toMatchObject({
      status: 403,
    });
  });

  it('reads the popular tags from the service, and none on any failure', async () => {
    const doFetch = vi.fn(async () => json({ tags: [{ tag: 'aws', count: 3 }] }));
    expect(await client(doFetch).popularTags()).toEqual(['aws']);
    expect(String((doFetch.mock.calls[0] as unknown as [string])[0])).toContain(
      'https://community.test',
    );
    expect(
      await communityPopularTags('livediagram.app', {
        fetch: vi.fn(async () => json({}, 500)),
      }),
    ).toEqual([]);
    expect(
      await communityPopularTags('livediagram.app', {
        fetch: vi.fn(async () => Promise.reject(new Error('offline'))),
      }),
    ).toEqual([]);
  });
});
