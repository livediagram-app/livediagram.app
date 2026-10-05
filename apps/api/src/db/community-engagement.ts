// What people do to Community posts (docs/specs/025-community/community.md "Likes", "Reports and moderation";
// blueprint §3 and §5): likes keyed by the community key, distinct copiers, reports with automatic hiding, and the
// operator's queue. Counts are recomputed in the same batch as the row that changes them, so they cannot drift.

import {
  COMMUNITY_AUTO_HIDE_REPORTERS,
  type CommunityPostState,
  type CommunityReport,
  type CommunityReportReason,
} from '@livediagram/api-schema';
import { COMMUNITY_POST_COLS, COMMUNITY_POST_FROM, type CommunityPostRow } from '../community-row';
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

export type ModerationRow = CommunityPostRow & { reports: CommunityReport[] };

// The operator's queue: every post that is hidden or has a report, most reported first. Trashed documents are left
// out: nobody can see them, so there is nothing to decide.
export async function listCommunityModeration(env: Env): Promise<ModerationRow[]> {
  const posts = await env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS}, (SELECT COUNT(*) FROM community_reports r WHERE r.post_id = cp.id) AS report_count
       FROM ${COMMUNITY_POST_FROM}
      WHERE d.trashed_at IS NULL
        AND (cp.state = 'hidden' OR EXISTS (SELECT 1 FROM community_reports r WHERE r.post_id = cp.id))
      ORDER BY report_count DESC, cp.published_at DESC
      LIMIT 200`,
  ).all<CommunityPostRow>();
  const rows = posts.results ?? [];
  if (rows.length === 0) return [];
  const reports = await env.DB.prepare(
    `SELECT post_id, reason, note, created_at FROM community_reports
      WHERE post_id IN (SELECT value FROM json_each(?)) ORDER BY created_at DESC`,
  )
    .bind(JSON.stringify(rows.map((r) => r.id)))
    .all<{
      post_id: string;
      reason: CommunityReportReason;
      note: string | null;
      created_at: number;
    }>();
  const byPost = new Map<string, CommunityReport[]>();
  for (const r of reports.results ?? []) {
    const list = byPost.get(r.post_id) ?? [];
    list.push({ reason: r.reason, note: r.note, createdAt: r.created_at });
    byPost.set(r.post_id, list);
  }
  return rows.map((row) => ({ ...row, reports: byPost.get(row.id) ?? [] }));
}

// An operator's decision. Restoring clears the reports, so only three new ones can hide the post again; hiding
// marks it as the operator's call. False when the post does not exist.
export async function moderateCommunityPost(
  env: Env,
  postId: string,
  state: CommunityPostState,
): Promise<boolean> {
  const update =
    state === 'listed'
      ? env.DB.prepare(
          "UPDATE community_posts SET state = 'listed', hidden_by = NULL WHERE id = ?",
        ).bind(postId)
      : env.DB.prepare(
          "UPDATE community_posts SET state = 'hidden', hidden_by = 'operator' WHERE id = ?",
        ).bind(postId);
  const statements = [update];
  if (state === 'listed') {
    statements.push(env.DB.prepare('DELETE FROM community_reports WHERE post_id = ?').bind(postId));
  }
  const [result] = await env.DB.batch(statements);
  return (result?.meta?.changes ?? 0) > 0;
}

// The one moderation item, after a decision, for the response.
export async function getCommunityModerationRow(
  env: Env,
  postId: string,
): Promise<ModerationRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${COMMUNITY_POST_COLS} FROM ${COMMUNITY_POST_FROM} WHERE cp.id = ?`,
  )
    .bind(postId)
    .first<CommunityPostRow>();
  if (!row) return null;
  const reports = await env.DB.prepare(
    'SELECT reason, note, created_at FROM community_reports WHERE post_id = ? ORDER BY created_at DESC',
  )
    .bind(postId)
    .all<{ reason: CommunityReportReason; note: string | null; created_at: number }>();
  return {
    ...row,
    reports: (reports.results ?? []).map((r) => ({
      reason: r.reason,
      note: r.note,
      createdAt: r.created_at,
    })),
  };
}
