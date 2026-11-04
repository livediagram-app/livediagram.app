import { describe, expect, it } from 'vitest';
import { checkCommunityPost, communityCheckDueAt, type CommunityCheck } from './post';

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
