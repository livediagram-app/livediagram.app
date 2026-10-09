// What people do to Community posts (docs/specs/025-community/community.md "Likes", "Reports and moderation";
// blueprint §3 and §5): likes keyed by the community key, distinct copiers, and reports with automatic hiding, the
// only moderation there is. Counts are recomputed in the same batch as the row that changes them, so they cannot drift.

import {
  COMMUNITY_AUTO_HIDE_REPORTERS,
  COMMUNITY_COUNTED_PER_NETWORK,
  type CommunityReportReason,
  sha256Hex,
} from '@livediagram/api-schema';
import { communityNetwork } from '../community-network';
import type { Runtime } from '../types';

// A post's like or copy count (blueprint §7): every row counts, but no network adds more than
// COMMUNITY_COUNTED_PER_NETWORK. A row from before networks were recorded (migration 0070) is its own network.
// `postIdSql` is the post id to count for: a bound parameter, or a column of the row being updated.
function cappedCountSql(
  table: 'community_likes' | 'community_copies',
  who: string,
  postIdSql: string,
): string {
  return `(SELECT COALESCE(SUM(MIN(n, ${COMMUNITY_COUNTED_PER_NETWORK})), 0) FROM (
            SELECT COUNT(*) AS n FROM ${table} WHERE post_id = ${postIdSql}
             GROUP BY COALESCE(network_hash, ${who})))`;
}

const LIKE_COUNT_SQL = (postIdSql: string) =>
  cappedCountSql('community_likes', 'liker_key', postIdSql);
export const COPY_COUNT_SQL = (postIdSql: string) =>
  cappedCountSql('community_copies', 'copier_id', postIdSql);

const RECOUNT_LIKES = `UPDATE community_posts SET like_count = ${LIKE_COUNT_SQL('?1')} WHERE id = ?1`;
const RECOUNT_COPIES = `UPDATE community_posts SET copy_count = ${COPY_COUNT_SQL('?1')} WHERE id = ?1`;

// Which of `postIds` this community key likes. One query for a whole page of cards.
export async function likedPostIds(
  env: Runtime,
  likerKey: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!likerKey || postIds.length === 0) return new Set();
  const result = await env.db
    .prepare(
      'SELECT post_id FROM community_likes WHERE liker_key = ? AND post_id IN (SELECT value FROM json_each(?))',
    )
    .bind(likerKey, JSON.stringify(postIds))
    .all<{ post_id: string }>();
  return new Set((result.results ?? []).map((r) => r.post_id));
}

// Like or unlike, idempotently, from the network `networkHash` names (communityNetworkHash). Returns the post's
// like count after the change.
export async function setCommunityLike(
  env: Runtime,
  postId: string,
  likerKey: string,
  liked: boolean,
  networkHash: string | null,
  now: number = Date.now(),
): Promise<number> {
  const change = liked
    ? env.db
        .prepare(
          'INSERT OR IGNORE INTO community_likes (post_id, liker_key, created_at, network_hash) VALUES (?, ?, ?, ?)',
        )
        .bind(postId, likerKey, now, networkHash)
    : env.db
        .prepare('DELETE FROM community_likes WHERE post_id = ? AND liker_key = ?')
        .bind(postId, likerKey);
  await env.db.batch([change, env.db.prepare(RECOUNT_LIKES).bind(postId)]);
  const row = await env.db
    .prepare('SELECT like_count FROM community_posts WHERE id = ?')
    .bind(postId)
    .first<{ like_count: number }>();
  return row?.like_count ?? 0;
}

// A copy taken through a community link, from the network `networkHash` names. Each person counts once however
// often they copy, and one network adds at most COMMUNITY_COUNTED_PER_NETWORK.
export async function recordCommunityCopy(
  env: Runtime,
  postId: string,
  copierId: string,
  networkHash: string | null,
  now: number = Date.now(),
): Promise<void> {
  await env.db.batch([
    env.db
      .prepare(
        'INSERT OR IGNORE INTO community_copies (post_id, copier_id, created_at, network_hash) VALUES (?, ?, ?, ?)',
      )
      .bind(postId, copierId, now, networkHash),
    env.db.prepare(RECOUNT_COPIES).bind(postId),
  ]);
}

// A report, once per community key per post. Hides the post automatically once reports come from
// COMMUNITY_AUTO_HIDE_REPORTERS distinct keys on as many distinct networks. Returns whether this report hid it.
export async function recordCommunityReport(
  env: Runtime,
  postId: string,
  reporterKey: string,
  networkHash: string,
  reason: CommunityReportReason,
  note: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  const inserted = await env.db
    .prepare(
      `INSERT OR IGNORE INTO community_reports (post_id, reporter_key, network_hash, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(postId, reporterKey, networkHash, reason, note, now)
    .run();
  if (!inserted.meta?.changes) return false;
  const hidden = await env.db
    .prepare(
      `UPDATE community_posts SET state = 'hidden', hidden_by = 'reports'
      WHERE id = ?1 AND state = 'listed'
        AND (SELECT COUNT(DISTINCT reporter_key) FROM community_reports WHERE post_id = ?1) >= ?2
        AND (SELECT COUNT(DISTINCT network_hash) FROM community_reports WHERE post_id = ?1) >= ?2`,
    )
    .bind(postId, COMMUNITY_AUTO_HIDE_REPORTERS)
    .run();
  return (hidden.meta?.changes ?? 0) > 0;
}

// The network a like, copy or report came from, as a one-way hash of its address range (communityNetwork) salted
// with the post id (blueprint §7): distinct networks can be counted per post, and nothing can be compared across
// posts.
export async function communityNetworkHash(postId: string, ip: string): Promise<string> {
  // The first 16 bytes of the digest, as hex.
  const hex = await sha256Hex(new TextEncoder().encode(`${postId}:${communityNetwork(ip)}`));
  return hex.slice(0, 32);
}
