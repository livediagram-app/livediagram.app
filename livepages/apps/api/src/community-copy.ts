import { communityNetworkHash, getCommunityPostByShareCode, recordCommunityCopy } from './db';
import type { Env } from './types';

// A copy taken through a Community post's link (docs/specs/025-community/community.md "Likes"): it counts toward the
// post's copy count, once per person and at most five per network. Best effort and off the response path: a failure
// is logged, never the copy's.
export async function countCommunityCopy(
  env: Env,
  shareCode: string,
  copierId: string,
  ip: string,
): Promise<void> {
  try {
    const post = await getCommunityPostByShareCode(env, shareCode);
    if (!post) return;
    await recordCommunityCopy(env, post.id, copierId, await communityNetworkHash(post.id, ip));
  } catch (err) {
    console.warn('[community] copy count failed', err);
  }
}
