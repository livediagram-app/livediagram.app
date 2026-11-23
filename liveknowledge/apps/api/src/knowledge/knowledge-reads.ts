// The knowledgebase's own numbers, read from its room (docs/specs/030-knowledgebase/knowledgebase-home.md,
// insights.md "Reads", "Always in Context", "Knowledge Health"): each one bounded read of the index's tables,
// never a scan of every page's writing.
import {
  countReviewDue,
  dayOf,
  recordRead,
  reviewDays,
  stableHash,
  tokensOfChars,
  type Reader,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import type {
  KnowledgeContextPage,
  KnowledgeDuePage,
  KnowledgeHealthCounts,
  KnowledgeRecentPage,
} from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { knowledgeDb, rowsOf, runAll } from './knowledge-db';

const DAY_MS = 86_400_000;
/** The pages Home lists as recently updated. */
export const RECENT_PAGES = 8;
/** The pages of the caller's own Home lists as due for review. */
export const OWN_DUE_PAGES = 10;

/** The pages marked Always in Context, in the tab list's order, each with its size. */
export async function contextPages(
  env: DocumentEnv,
  documentId: string,
): Promise<KnowledgeContextPage[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT t.id AS tab, t.name AS title, COALESCE(k.chars, 0) AS chars
       FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
       LEFT JOIN knowledge_pages k ON k.tab = t.id
      WHERE dt.document_id = ? AND json_valid(t.data) AND json_extract(t.data, '$.knowledge.context') = 1
      ORDER BY dt.order_index ASC`,
  )
    .bind(documentId)
    .all<{ tab: string; title: string; chars: number }>();
  return (results ?? []).map((r) => ({
    tab: r.tab,
    title: r.title,
    tokens: tokensOfChars(r.chars),
  }));
}

// A page verified at or before this is due under a Review Period; null for Never, which no page is at or before.
const dueBefore = (every: ReviewEvery, now: number): number | null => {
  const days = reviewDays(every);
  return days === undefined ? null : now - days * DAY_MS;
};

/** Verified, Review Due and Never Verified, worked out from the trust rows, the knowledgebase's Review Period and
 *  the clock; a page not yet indexed (the backfill is behind) counts as never verified. */
export async function knowledgeHealthCounts(
  env: DocumentEnv,
  documentId: string,
  every: ReviewEvery,
  now: number,
): Promise<KnowledgeHealthCounts> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN p.verified_at IS NULL THEN 1 ELSE 0 END) AS never,
            SUM(CASE WHEN p.verified_at <= ? THEN 1 ELSE 0 END) AS due
       FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id LEFT JOIN page_trust p ON p.tab = dt.tab_id
      WHERE dt.document_id = ? AND t.connection IS NULL`,
  )
    .bind(dueBefore(every, now), documentId)
    .first<{ total: number; never: number | null; due: number | null }>();
  const total = row?.total ?? 0;
  const neverVerified = row?.never ?? 0;
  const reviewDue = row?.due ?? 0;
  return { verified: total - neverVerified - reviewDue, reviewDue, neverVerified, total };
}

/**
 * How many pages would be Review Due under a Review Period (verification.md "The Review Period": the dialog says
 * so before a shorter period is applied). One read of the index on `page_trust.verified_at`, a row a verified page
 * (500 at most); nothing for Never, which makes no page due.
 */
export async function reviewDueCount(
  env: DocumentEnv,
  every: ReviewEvery,
  now: number,
): Promise<number> {
  const days = reviewDays(every);
  if (days === undefined) return 0;
  const [row] = await rowsOf<{ due: number }>(env, countReviewDue(days, now));
  return row?.due ?? 0;
}

/** The pages changed most recently. */
export async function recentPages(
  env: DocumentEnv,
  documentId: string,
): Promise<KnowledgeRecentPage[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT t.id AS tab, t.name AS title, t.updated_at AS updatedAt
       FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ? AND t.connection IS NULL
      ORDER BY t.updated_at DESC, dt.order_index ASC LIMIT ${RECENT_PAGES}`,
  )
    .bind(documentId)
    .all<KnowledgeRecentPage>();
  return results ?? [];
}

/**
 * The pages `owner` answers for whose review is due (verification.md "Reminders"), the longest overdue first,
 * `OWN_DUE_PAGES` at most. Due is what the health counts call due: verified, and the knowledgebase's Review
 * Period past (none under Never, which reads nothing). The trust rows are read first (a range of the index on
 * `verified_at`), and a page's body is only looked at, for its owner, once its row says it is due.
 */
export async function ownDuePages(
  env: DocumentEnv,
  documentId: string,
  owner: string,
  every: ReviewEvery,
  now: number,
): Promise<KnowledgeDuePage[]> {
  const days = reviewDays(every);
  if (days === undefined) return [];
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT t.id AS tab, t.name AS title, due.verified_at + ? AS reviewAt
       FROM (SELECT p.tab, p.verified_at FROM page_trust p
              WHERE p.verified_at IS NOT NULL AND p.verified_at <= ?) due
       JOIN document_tabs dt ON dt.tab_id = due.tab
       JOIN tabs t ON t.id = due.tab
      WHERE dt.document_id = ? AND json_valid(t.data) AND json_extract(t.data, '$.knowledge.owner') = ?
      ORDER BY due.verified_at ASC, dt.order_index ASC LIMIT ${OWN_DUE_PAGES}`,
  )
    .bind(days * DAY_MS, now - days * DAY_MS, documentId, owner)
    .all<KnowledgeDuePage>();
  return results ?? [];
}

/**
 * Count one read of a page (insights.md "Reads"). An agent's every read counts. A person's counts once a page a
 * day: the counter that says "already counted" is keyed by a hash of the person and the page, so no reader's
 * identity is kept, and it goes with the day's other counters within two days (`pruneCounters`).
 */
export async function countRead(
  env: DocumentEnv,
  tab: string,
  reader: Reader,
  person: string | null,
  now = Date.now(),
): Promise<boolean> {
  if (reader.kind === 'agent') {
    await runAll(env, [recordRead(tab, reader, now)]);
    return true;
  }
  if (!person) return false;
  // The first open of the day makes the row; a later one writes nothing at all.
  const first = await knowledgeDb(env)
    .prepare(
      `INSERT INTO usage_counters (scope, period, used) VALUES (?, ?, 1) ON CONFLICT (scope, period) DO NOTHING`,
    )
    .bind(`read:${stableHash(person, tab)}`, dayOf(now))
    .run();
  if ((first.meta.changes ?? 0) === 0) return false;
  await runAll(env, [recordRead(tab, reader, now)]);
  return true;
}
