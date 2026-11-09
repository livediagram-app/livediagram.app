import { describe, expect, it } from 'vitest';
import {
  checkCommunityPost,
  communityCheckDueAt,
  communityStateOf,
  type CommunityCheck,
  type CommunityIndex,
  type CommunityPost,
} from './post';

// A room asks where its Community post stands on its alarm, then re-arms for communityCheckDueAt(post). Without the
// service (no COMMUNITY_KEY) there is nothing to ask, and the answer must still move the next check on: a stale
// `checkedAt` put the alarm in the past, so it rang back to back.

const ROW = {
  share_code: 'CODE2345',
  author_id: 'user_a',
  post_id: 'p1',
  title: 'A post',
  anonymous: 0,
  hidden_at: null,
  sent_state: 'listed',
  checked_at: 1_000,
};

const db = {
  prepare: () => ({ first: async () => ROW }),
} as unknown as CommunityCheck['db'];

describe('checkCommunityPost without the service', () => {
  it('counts the check as made, so the next one is due in the future', async () => {
    const now = 5_000_000;
    const post = await checkCommunityPost({
      env: {},
      db,
      service: {} as CommunityCheck['service'],
      documentId: 'd1',
      meta: null,
      indexAs: () => null,
      now,
    } as CommunityCheck);
    expect(post?.checkedAt).toBe(now);
    expect(communityCheckDueAt(post)).toBeGreaterThan(now);
  });
});

describe('communityStateOf', () => {
  const post = { authorId: 'user_a', shareCode: 'CODE2345' } as CommunityPost;
  const indexWith = (ownerId: string, teamId: string | null = 'team_1') =>
    ({
      getItem: async () => ({ item: { trashedAt: null, ownerId, teamId } }),
      listShareLinks: async () => ({ links: [{ code: 'CODE2345' }], passwordSet: false }),
    }) as unknown as CommunityIndex;

  it('is gone once the owner’s account closed, as the room or the index knows it', async () => {
    expect(
      await communityStateOf(indexWith('deleted'), 'd1', post, { ownerId: 'deleted', teamId: 't' }),
    ).toBe('gone');
    // The room still names the author, the index already says the account closed.
    expect(
      await communityStateOf(indexWith('deleted'), 'd1', post, { ownerId: 'user_a', teamId: 't' }),
    ).toBe('gone');
  });

  it('keeps a team document’s post closed while its author owns it, and away once someone else does', async () => {
    expect(
      await communityStateOf(indexWith('user_a'), 'd1', post, { ownerId: 'user_a', teamId: 't' }),
    ).toBe('closed');
    expect(
      await communityStateOf(indexWith('user_b'), 'd1', post, { ownerId: 'user_b', teamId: 't' }),
    ).toBe('away');
  });
});
