// Tab stats storage (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come
// from"): per tab, what the Explorer's Details view sums over a document, kept in `tab_stats`
// (migration 0084) beside each tab so a document list reads them without reading any tab body.
import type { DocumentStats } from '@livediagram/api-schema';
import { parseEditorMode, tabStatsOf, type TabStats } from '@livediagram/document';
import type { Env } from '../types';

// The counting itself is the document model's, shared with the browser's own documents.
export { tabStatsOf, type TabStats };

// A stored body's stats, parsing it. A body that is not a JSON object counts as an empty Diagram
// tab, its bytes still measured, and says so (`corrupt`), so a caller can log it and never retry.
export function tabStatsOfData(data: string): { stats: TabStats; corrupt: boolean } {
  try {
    const body: unknown = JSON.parse(data);
    if (body && typeof body === 'object') return { stats: tabStatsOf(body, data), corrupt: false };
  } catch {
    // Counted empty below.
  }
  return { stats: tabStatsOf({}, data), corrupt: true };
}

// The upsert every tab write batches after its `tabs` statement (the foreign key needs the row).
// `ifStoredData`: only when the tab now stores exactly that body, for a conditional write (a swap)
// whose stats must land only if the write did.
export function tabStatsStatement(
  env: Env,
  tabId: string,
  stats: TabStats,
  writtenAt: number,
  ifStoredData?: string,
): D1PreparedStatement {
  const guard =
    ifStoredData === undefined
      ? 'WHERE true'
      : 'WHERE EXISTS (SELECT 1 FROM tabs WHERE id = ?1 AND data = ?7)';
  return env.DB.prepare(
    `INSERT INTO tab_stats (tab_id, mode, element_count, comment_count, data_bytes, written_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6 ${guard}
     ON CONFLICT(tab_id) DO UPDATE SET
       mode = excluded.mode,
       element_count = excluded.element_count,
       comment_count = excluded.comment_count,
       data_bytes = excluded.data_bytes,
       written_at = excluded.written_at`,
  ).bind(
    tabId,
    stats.mode,
    stats.elementCount,
    stats.commentCount,
    stats.dataBytes,
    writtenAt,
    ...(ifStoredData === undefined ? [] : [ifStoredData]),
  );
}

// A document's stats as a `doc_stats` column: JSON text, or NULL when the document links no tab or
// a tab without stats. Reads `document_tabs` and `tab_stats` only, never a tab body. The mode is
// the tab written last, ties to the earlier tab in the document's order.
export function documentStatsSql(documentIdSql: string): string {
  return `(SELECT CASE
             WHEN COUNT(*) = 0 OR COUNT(s.tab_id) < COUNT(*) THEN NULL
             ELSE json_object(
               'mode', (SELECT s2.mode
                          FROM document_tabs dt2
                          JOIN tab_stats s2 ON s2.tab_id = dt2.tab_id
                         WHERE dt2.document_id = ${documentIdSql}
                         ORDER BY s2.written_at DESC, dt2.order_index ASC
                         LIMIT 1),
               'elements', SUM(s.element_count),
               'comments', SUM(s.comment_count),
               'bytes', SUM(s.data_bytes))
           END
           FROM document_tabs dt
           LEFT JOIN tab_stats s ON s.tab_id = dt.tab_id
          WHERE dt.document_id = ${documentIdSql}) AS doc_stats`;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// The `doc_stats` column as the wire's DocumentStats; null when absent or unreadable.
export function readDocumentStats(raw: string | null | undefined): DocumentStats | null {
  if (raw == null) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const mode = parseEditorMode(v.mode);
    if (mode && isCount(v.elements) && isCount(v.comments) && isCount(v.bytes)) {
      return { mode, elements: v.elements, comments: v.comments, bytes: v.bytes };
    }
  } catch {
    // Reported below with the shape it had.
  }
  console.warn('tab-stats: unreadable doc_stats', raw.slice(0, 120));
  return null;
}
