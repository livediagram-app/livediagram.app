// What people do to posts (liveworkspace/docs/community.md "Public routes"): likes keyed by the
// community key, distinct copiers, and reports with automatic hiding, the only moderation there is.
// Counts are recomputed in the same batch as the row that changes them, so they cannot drift.

import {
  COMMUNITY_AUTO_HIDE_REPORTERS,
  COMMUNITY_COUNTED_PER_NETWORK,
  type CommunityApp,
  type CommunityReportReason,
} from '@liveworkspace/community';
import type { Env } from './env';

// A post's like or copy count: every row counts, but no network adds more than
// COMMUNITY_COUNTED_PER_NETWORK. `postIdSql` is the post id to count for: a bound parameter, or a
// column of the row being updated.
function cappedCountSql(table: 'likes' | 'copies', postIdSql: string): string {
  return `(SELECT COALESCE(SUM(MIN(n, ${COMMUNITY_COUNTED_PER_NETWORK})), 0) FROM (
            SELECT COUNT(*) AS n FROM ${table} WHERE post_id = ${postIdSql} GROUP BY network_hash))`;
}

const RECOUNT_LIKES = `UPDATE posts SET like_count = ${cappedCountSql('likes', '?1')} WHERE id = ?1`;
const RECOUNT_COPIES = `UPDATE posts SET copy_count = ${cappedCountSql('copies', '?1')} WHERE id = ?1`;
// Every post of the app this copier has copied, recounted: after their copies are forgotten or moved.
const RECOUNT_COPIER_POSTS = (where: string) =>
  `UPDATE posts SET copy_count = ${cappedCountSql('copies', 'posts.id')} WHERE ${where}`;

// Which of `postIds` this community key likes. One query for a whole page of cards.
export async function likedPostIds(
  env: Env,
  likerKey: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!likerKey || postIds.length === 0) return new Set();
  const result = await env.COMMUNITY_DB.prepare(
    'SELECT post_id FROM likes WHERE liker_key = ? AND post_id IN (SELECT value FROM json_each(?))',
  )
    .bind(likerKey, JSON.stringify(postIds))
    .all<{ post_id: string }>();
  return new Set((result.results ?? []).map((r) => r.post_id));
}

// Like or unlike, idempotently, from the network `networkHash` names. Returns the post's like count
// after the change.
export async function setLike(
  env: Env,
  postId: string,
  likerKey: string,
  liked: boolean,
  networkHash: string,
  now: number = Date.now(),
): Promise<number> {
  const change = liked
    ? env.COMMUNITY_DB.prepare(
        'INSERT OR IGNORE INTO likes (post_id, liker_key, network_hash, created_at) VALUES (?, ?, ?, ?)',
      ).bind(postId, likerKey, networkHash, now)
    : env.COMMUNITY_DB.prepare('DELETE FROM likes WHERE post_id = ? AND liker_key = ?').bind(
        postId,
        likerKey,
      );
  // The count comes back in the same batch, so the answer is the count this change left.
  const [, , counted] = await env.COMMUNITY_DB.batch<{ like_count: number }>([
    change,
    env.COMMUNITY_DB.prepare(RECOUNT_LIKES).bind(postId),
    env.COMMUNITY_DB.prepare('SELECT like_count FROM posts WHERE id = ?').bind(postId),
  ]);
  return counted?.results?.[0]?.like_count ?? 0;
}

// A copy taken through a post's community link, from the network `networkHash` names. Each person
// counts once however often they copy, and one network adds at most COMMUNITY_COUNTED_PER_NETWORK.
export async function recordCopy(
  env: Env,
  postId: string,
  copier: string,
  networkHash: string,
  now: number = Date.now(),
): Promise<void> {
  await env.COMMUNITY_DB.batch([
    env.COMMUNITY_DB.prepare(
      'INSERT OR IGNORE INTO copies (post_id, copier, network_hash, created_at) VALUES (?, ?, ?, ?)',
    ).bind(postId, copier, networkHash, now),
    env.COMMUNITY_DB.prepare(RECOUNT_COPIES).bind(postId),
  ]);
}

const APP_POSTS = 'post_id IN (SELECT id FROM posts WHERE app = ?2)';

// An account was deleted in the app: the copies it took of the app's posts go, and those posts'
// copy counts drop.
export async function forgetCopier(env: Env, app: CommunityApp, copier: string): Promise<void> {
  const copied = await env.COMMUNITY_DB.prepare(
    `SELECT post_id FROM copies WHERE copier = ?1 AND ${APP_POSTS}`,
  )
    .bind(copier, app)
    .all<{ post_id: string }>();
  const postIds = (copied.results ?? []).map((r) => r.post_id);
  if (postIds.length === 0) return;
  await env.COMMUNITY_DB.batch([
    env.COMMUNITY_DB.prepare(`DELETE FROM copies WHERE copier = ?1 AND ${APP_POSTS}`).bind(
      copier,
      app,
    ),
    env.COMMUNITY_DB.prepare(RECOUNT_COPIER_POSTS('id IN (SELECT value FROM json_each(?1))')).bind(
      JSON.stringify(postIds),
    ),
  ]);
}

// A guest's work moved to their new account in the app: their copies become the account's (a post the
// account had copied too keeps one), and those posts are recounted.
export async function mergeCopier(
  env: Env,
  app: CommunityApp,
  from: string,
  to: string,
): Promise<void> {
  await env.COMMUNITY_DB.batch([
    env.COMMUNITY_DB.prepare(
      `INSERT OR IGNORE INTO copies (post_id, copier, network_hash, created_at)
       SELECT post_id, ?3, network_hash, created_at FROM copies WHERE copier = ?1 AND ${APP_POSTS}`,
    ).bind(from, app, to),
    env.COMMUNITY_DB.prepare(`DELETE FROM copies WHERE copier = ?1 AND ${APP_POSTS}`).bind(
      from,
      app,
    ),
    env.COMMUNITY_DB.prepare(
      RECOUNT_COPIER_POSTS('id IN (SELECT post_id FROM copies WHERE copier = ?1) AND app = ?2'),
    ).bind(to, app),
  ]);
}

// A report, once per community key per post. Hides the post once reports come from
// COMMUNITY_AUTO_HIDE_REPORTERS distinct keys on as many distinct networks. Returns whether this
// report hid it.
export async function recordReport(
  env: Env,
  postId: string,
  reporterKey: string,
  networkHash: string,
  reason: CommunityReportReason,
  note: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  const inserted = await env.COMMUNITY_DB.prepare(
    `INSERT OR IGNORE INTO reports (post_id, reporter_key, network_hash, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(postId, reporterKey, networkHash, reason, note, now)
    .run();
  if (!inserted.meta?.changes) return false;
  const hidden = await env.COMMUNITY_DB.prepare(
    `UPDATE posts SET state = 'hidden', hidden_at = ?3
      WHERE id = ?1 AND state = 'listed'
        AND (SELECT COUNT(DISTINCT reporter_key) FROM reports WHERE post_id = ?1) >= ?2
        AND (SELECT COUNT(DISTINCT network_hash) FROM reports WHERE post_id = ?1) >= ?2`,
  )
    .bind(postId, COMMUNITY_AUTO_HIDE_REPORTERS, now)
    .run();
  return (hidden.meta?.changes ?? 0) > 0;
}
