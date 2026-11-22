// The Health Score's facts, read from the room (docs/specs/030-knowledgebase/verification.md "Health Score";
// blueprint knowledge-package.md "Page Health"): one statement for every page of the knowledgebase, or for a set of
// pages (chunked at 50, under the 100 bound values a statement may take). Each count is a correlated read on an index
// the table already has, and no page's writing is read: the index kept its words, headings and owner (schema step
// 36). Scored with `pageHealth`, the same function the editor runs.
import {
  daysBefore,
  healthFactsOf,
  healthWire,
  pageHealth,
  type PageHealthRow,
  type PageHealthScore,
  type PageHealthWire,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import type { DocumentEnv } from '../types';

const CHUNK = 50;

const FACTS = `SELECT t.id AS tab, t.name AS title, pt.verified_at AS verifiedAt,
    COALESCE(k.owned, CASE WHEN json_valid(t.data) AND json_extract(t.data, '$.knowledge.owner') IS NOT NULL
      THEN 1 ELSE 0 END) AS owned,
    k.words AS words, k.chars AS chars, k.headings AS headings,
    (SELECT COUNT(*) FROM page_links l WHERE l.from_tab = t.id
       AND NOT EXISTS (SELECT 1 FROM document_tabs x WHERE x.document_id = dt.document_id AND x.tab_id = l.to_tab))
      AS brokenLinks,
    (SELECT COUNT(*) FROM page_links l WHERE l.to_tab = t.id AND l.from_tab <> t.id) AS backlinks,
    (SELECT COUNT(*) FROM page_threads th WHERE th.tab = t.id AND th.resolved = 0) AS openThreads,
    (SELECT COUNT(*) FROM page_approvals ap WHERE ap.tab = t.id AND ap.state = 'pending') AS pendingApproval,
    (SELECT COUNT(*) FROM conflicts c WHERE c.state = 'open' AND c.a_tab = t.id)
      + (SELECT COUNT(*) FROM conflicts c WHERE c.state = 'open' AND c.b_tab = t.id) AS openConflicts,
    (SELECT COUNT(*) FROM suggestions s WHERE s.tab = t.id) AS suggestions,
    (SELECT COALESCE(SUM(r.reads), 0) FROM page_reads r WHERE r.tab = t.id AND r.day > ?) AS reads,
    a.created_at AS createdAt, a.updated_at AS updatedAt
  FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
    LEFT JOIN page_trust pt ON pt.tab = t.id
    LEFT JOIN knowledge_pages k ON k.tab = t.id
    LEFT JOIN page_authors a ON a.tab = t.id
  WHERE dt.document_id = ? AND t.connection IS NULL`;

/** A page's facts row with its tree place, for ties. */
export type PageHealthFactsRow = PageHealthRow & { order: number };

/** The facts of every page (`tabs` undefined), or of the given pages, in tree order. */
export async function pageHealthRows(
  env: DocumentEnv,
  documentId: string,
  now: number,
  tabs?: readonly string[],
): Promise<PageHealthFactsRow[]> {
  const since = daysBefore(now, 7);
  const read = async (chunk?: readonly string[]) =>
    (
      await env.DOCUMENT_DB.prepare(
        `${FACTS}${chunk ? ` AND t.id IN (${chunk.map(() => '?').join(', ')})` : ''} ORDER BY dt.order_index`,
      )
        .bind(since, documentId, ...(chunk ?? []))
        .all<PageHealthRow>()
    ).results ?? [];
  if (tabs === undefined) return (await read()).map((row, order) => ({ ...row, order }));
  const unique = [...new Set(tabs)];
  const rows: PageHealthRow[] = [];
  for (let at = 0; at < unique.length; at += CHUNK)
    rows.push(...(await read(unique.slice(at, at + CHUNK))));
  return rows.map((row, order) => ({ ...row, order }));
}

/** Each page's score, by tab. */
export async function pageHealthScores(
  env: DocumentEnv,
  documentId: string,
  every: ReviewEvery,
  now: number,
  tabs?: readonly string[],
): Promise<Map<string, { row: PageHealthFactsRow; health: PageHealthScore }>> {
  if (tabs !== undefined && tabs.length === 0) return new Map();
  const rows = await pageHealthRows(env, documentId, now, tabs);
  return new Map(
    rows.map((row) => [row.tab, { row, health: pageHealth(healthFactsOf(row, every, now), now) }]),
  );
}

/** Each page's score as agents read it, by tab. */
export async function pageHealthWires(
  env: DocumentEnv,
  documentId: string,
  every: ReviewEvery,
  now: number,
  tabs: readonly string[],
): Promise<Map<string, PageHealthWire>> {
  const scores = await pageHealthScores(env, documentId, every, now, tabs);
  return new Map([...scores].map(([tab, { health }]) => [tab, healthWire(health)]));
}
