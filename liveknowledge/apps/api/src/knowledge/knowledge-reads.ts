// The knowledgebase's own numbers, read from its room (docs/specs/030-knowledgebase/knowledgebase-home.md,
// ai-knowledge.md "Reads", "Always in Context", "Knowledge Health"): each one bounded read of the index's tables,
// never a scan of every page's writing.
import {
  dayOf,
  recordRead,
  stableHash,
  tokensOfChars,
  type Reader,
} from '@liveknowledge/knowledge';
import type {
  KnowledgeContextPage,
  KnowledgeHealthCounts,
  KnowledgeRecentPage,
} from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { knowledgeDb, runAll } from './knowledge-db';

const DAY_MS = 86_400_000;
/** The pages Home lists as recently updated. */
export const RECENT_PAGES = 8;

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

/** Verified, Review Due and Never Verified, worked out from the trust rows and the clock; a page not yet indexed
 *  (the backfill is behind) counts as never verified. */
export async function knowledgeHealthCounts(
  env: DocumentEnv,
  documentId: string,
  now: number,
): Promise<KnowledgeHealthCounts> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN p.verified_at IS NULL THEN 1 ELSE 0 END) AS never,
            SUM(CASE WHEN p.verified_at IS NOT NULL AND p.review_days IS NOT NULL
                      AND p.verified_at + p.review_days * ${DAY_MS} <= ? THEN 1 ELSE 0 END) AS due
       FROM document_tabs dt LEFT JOIN page_trust p ON p.tab = dt.tab_id
      WHERE dt.document_id = ?`,
  )
    .bind(now, documentId)
    .first<{ total: number; never: number | null; due: number | null }>();
  const total = row?.total ?? 0;
  const neverVerified = row?.never ?? 0;
  const reviewDue = row?.due ?? 0;
  return { verified: total - neverVerified - reviewDue, reviewDue, neverVerified, total };
}

/** The pages changed most recently. */
export async function recentPages(
  env: DocumentEnv,
  documentId: string,
): Promise<KnowledgeRecentPage[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT t.id AS tab, t.name AS title, t.updated_at AS updatedAt
       FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ? ORDER BY t.updated_at DESC, dt.order_index ASC LIMIT ${RECENT_PAGES}`,
  )
    .bind(documentId)
    .all<KnowledgeRecentPage>();
  return results ?? [];
}

/**
 * Count one read of a page (ai-knowledge.md "Reads"). An agent's every read counts. A person's counts once a page a
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
