// The Forum's counters (liveworkspace/docs/specs/007-community/community.md "Limits per account", "The check"): each
// account's writes and reactions per clock hour, and the checks every account made together per UTC day, kept in the
// service's own database (no other binding). One upsert per count, which answers the count it left.

import { FORUM_CHECK_TALLY_KEEP_DAYS, FORUM_TALLY_PREFIX } from '../config';
import type { Env } from '../env';

export const HOUR_MS = 60 * 60_000;
export const DAY_MS = 24 * HOUR_MS;

/** Adds one to `subject`'s count in the window `now` falls in, and answers whether it is still within `limit`. A count
 *  past the limit stays counted, so a caller that keeps trying never gets back under it in the same window. */
export async function countAgainst(
  env: Env,
  subject: string,
  windowMs: number,
  limit: number,
  now: number,
): Promise<boolean> {
  const bucket = Math.floor(now / windowMs) * windowMs;
  const row = await env.COMMUNITY_DB.prepare(
    `INSERT INTO forum_counters (subject, bucket, n) VALUES (?1, ?2, 1)
       ON CONFLICT (subject, bucket) DO UPDATE SET n = n + 1
     RETURNING n`,
  )
    .bind(subject, bucket)
    .first<{ n: number }>();
  return (row?.n ?? 1) <= limit;
}

/** Drops every window older than two days (none of them can be counted against again), and the check's daily tally
 *  once it is older than the dashboard shows. */
export async function pruneForumCounters(env: Env, now: number): Promise<void> {
  await env.COMMUNITY_DB.prepare(
    `DELETE FROM forum_counters WHERE bucket < CASE WHEN subject LIKE ?3 THEN ?1 ELSE ?2 END`,
  )
    .bind(now - FORUM_CHECK_TALLY_KEEP_DAYS * DAY_MS, now - 2 * DAY_MS, `${FORUM_TALLY_PREFIX}%`)
    .run();
}
