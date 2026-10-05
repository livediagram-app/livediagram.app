// What people do to Community posts (docs/specs/025-community/community.md "Likes", "Reports and moderation";
// blueprint §3 and §5): likes keyed by the community key, distinct copiers, and reports with automatic hiding, the
// only moderation there is. Counts are recomputed in the same batch as the row that changes them, so they cannot drift.

import { COMMUNITY_AUTO_HIDE_REPORTERS, type CommunityReportReason } from '@livediagram/api-schema';
import type { Env } from '../types';

const RECOUNT_LIKES =
  'UPDATE community_posts SET like_count = (SELECT COUNT(*) FROM community_likes WHERE post_id = ?1) WHERE id = ?1';
const RECOUNT_COPIES =
  'UPDATE community_posts SET copy_count = (SELECT COUNT(*) FROM community_copies WHERE post_id = ?1) WHERE id = ?1';

// Which of `postIds` this community key likes. One query for a whole page of cards.
export async function likedPostIds(
  env: Env,
  likerKey: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!likerKey || postIds.length === 0) return new Set();
  const result = await env.DB.prepare(
    'SELECT post_id FROM community_likes WHERE liker_key = ? AND post_id IN (SELECT value FROM json_each(?))',
  )
    .bind(likerKey, JSON.stringify(postIds))
    .all<{ post_id: string }>();
  return new Set((result.results ?? []).map((r) => r.post_id));
}

// Like or unlike, idempotently. Returns the post's like count after the change.
export async function setCommunityLike(
  env: Env,
  postId: string,
  likerKey: string,
  liked: boolean,
  now: number = Date.now(),
): Promise<number> {
  const change = liked
    ? env.DB.prepare(
        'INSERT OR IGNORE INTO community_likes (post_id, liker_key, created_at) VALUES (?, ?, ?)',
      ).bind(postId, likerKey, now)
    : env.DB.prepare('DELETE FROM community_likes WHERE post_id = ? AND liker_key = ?').bind(
        postId,
        likerKey,
      );
  await env.DB.batch([change, env.DB.prepare(RECOUNT_LIKES).bind(postId)]);
  const row = await env.DB.prepare('SELECT like_count FROM community_posts WHERE id = ?')
    .bind(postId)
    .first<{ like_count: number }>();
  return row?.like_count ?? 0;
}

// A copy taken through a community link. Each person counts once however often they copy.
export async function recordCommunityCopy(
  env: Env,
  postId: string,
  copierId: string,
  now: number = Date.now(),
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO community_copies (post_id, copier_id, created_at) VALUES (?, ?, ?)',
    ).bind(postId, copierId, now),
    env.DB.prepare(RECOUNT_COPIES).bind(postId),
  ]);
}

// A report, once per community key per post. Hides the post automatically once reports come from
// COMMUNITY_AUTO_HIDE_REPORTERS distinct keys on as many distinct networks. Returns whether this report hid it.
export async function recordCommunityReport(
  env: Env,
  postId: string,
  reporterKey: string,
  networkHash: string,
  reason: CommunityReportReason,
  note: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO community_reports (post_id, reporter_key, network_hash, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(postId, reporterKey, networkHash, reason, note, now)
    .run();
  if (!inserted.meta?.changes) return false;
  const hidden = await env.DB.prepare(
    `UPDATE community_posts SET state = 'hidden', hidden_by = 'reports'
      WHERE id = ?1 AND state = 'listed'
        AND (SELECT COUNT(DISTINCT reporter_key) FROM community_reports WHERE post_id = ?1) >= ?2
        AND (SELECT COUNT(DISTINCT network_hash) FROM community_reports WHERE post_id = ?1) >= ?2`,
  )
    .bind(postId, COMMUNITY_AUTO_HIDE_REPORTERS)
    .run();
  return (hidden.meta?.changes ?? 0) > 0;
}

// The network a report came from, as a one-way hash salted with the post id (blueprint §7): distinct networks can
// be counted per post, and nothing can be compared across posts.
export async function communityNetworkHash(postId: string, ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${postId}:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}
