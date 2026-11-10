// The Community sweep's door (`POST /api/internal/items/community-states`): the app's COMMUNITY_KEY alone, a checked
// body, the index's answer passed on only when well formed, and a 503 the sweep retries when the index fails.
import { COMMUNITY_STATES_MAX } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleInternalItems, type InternalItemHandlers } from './internal';

afterEach(() => vi.restoreAllMocks());

const PATH = '/api/internal/items/community-states';
const POSTS = [{ id: 'doc-1', code: 'ABCD1234', owner: 'user_a' }];

const send = (
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  options: { auth?: string; communityKey?: string | undefined; method?: string } = {},
) =>
  handleInternalItems(
    new Request(`https://app.test${PATH}`, {
      method: options.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${options.auth ?? 'ck'}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    {
      key: 'index-key',
      communityKey: 'communityKey' in options ? options.communityKey : 'ck',
      handlers: { purge: async () => {}, ...handlers },
    },
  );

describe('the community-states door', () => {
  it("answers the index's states for the posts asked, with the community key", async () => {
    const communityStates = vi.fn(async () => [{ id: 'doc-1', state: 'away' as const }]);
    const res = await send({ posts: POSTS }, { communityStates });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ states: [{ id: 'doc-1', state: 'away' }] });
    expect(communityStates).toHaveBeenCalledWith(POSTS);
  });

  it("takes the community key alone: never the index's, and nothing without one", async () => {
    const communityStates = vi.fn(async () => []);
    expect((await send({ posts: POSTS }, { communityStates }, { auth: 'index-key' })).status).toBe(
      401,
    );
    expect(
      (await send({ posts: POSTS }, { communityStates }, { communityKey: undefined })).status,
    ).toBe(404);
    // The community key opens no other door.
    const purge = vi.fn(async () => {});
    const other = await handleInternalItems(
      new Request('https://app.test/api/internal/items/A', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ck' },
      }),
      { key: 'index-key', communityKey: 'ck', handlers: { purge } },
    );
    expect(other.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
    expect(communityStates).not.toHaveBeenCalled();
  });

  it('is a 404 for an app without the handler', async () => {
    expect((await send({ posts: POSTS }, {})).status).toBe(404);
  });

  it('refuses a malformed or oversized body', async () => {
    const communityStates = vi.fn(async () => []);
    const many = Array.from({ length: COMMUNITY_STATES_MAX + 1 }, (_, i) => ({
      ...POSTS[0]!,
      id: `doc-${i}`,
    }));
    for (const body of [
      {},
      { posts: [] },
      { posts: many },
      { posts: [null] },
      { posts: [{ id: 'doc-1', code: 'ABCD1234' }] },
      { posts: [{ id: 'doc-1', code: 'not a code', owner: 'user_a' }] },
      { posts: [{ id: '', code: 'ABCD1234', owner: 'user_a' }] },
    ]) {
      expect((await send(body, { communityStates })).status).toBe(400);
    }
    expect(communityStates).not.toHaveBeenCalled();
  });

  it('answers 503 when the index fails or answers something malformed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down = await send(
      { posts: POSTS },
      {
        communityStates: async () => {
          throw new Error('index down');
        },
      },
    );
    expect(down.status).toBe(503);
    const odd = await send(
      { posts: POSTS },
      { communityStates: async () => [{ id: 'doc-1', state: 'deleted' as never }] },
    );
    expect(odd.status).toBe(503);
  });
});
