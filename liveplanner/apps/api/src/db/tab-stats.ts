// Tab stats storage (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come
// from"): per tab, what the Explorer's Details view sums over a project, kept in `tab_stats`
// beside each tab so a project list reads them without reading any tab body.
import type { ProjectStats } from '@liveplanner/api-schema';
import {
  parseEditorMode,
  tabKindOf,
  tabStatsOf,
  type TabKind,
  type TabStats,
} from '@liveplanner/project';
import type { PlanEnv } from '../types';

// The counting itself is the project model's, shared with the browser's own projects.
export { tabStatsOf, type TabStats };

// What a tab write keeps beside its body: the Details view's numbers, and the tab's kind, so the tab picker's read
// (`GET /api/projects/:id/tabs`) names each tab's kind without parsing any body.
export type StoredTabStats = TabStats & { kind: TabKind };

export function storedTabStatsOf(body: object, data: string): StoredTabStats {
  return { ...tabStatsOf(body, data), kind: tabKindOf(body) };
}

// A stored body's stats, parsing it. A body that is not a JSON object counts as an empty Diagram
// tab, its bytes still measured, and says so (`corrupt`), so a caller can log it and never retry.
export function tabStatsOfData(data: string): { stats: StoredTabStats; corrupt: boolean } {
  try {
    const body: unknown = JSON.parse(data);
    if (body && typeof body === 'object')
      return { stats: storedTabStatsOf(body, data), corrupt: false };
  } catch {
    // Counted empty below.
  }
  return { stats: storedTabStatsOf({}, data), corrupt: true };
}

// The upsert every tab write batches after its `tabs` statement (the foreign key needs the row).
// `ifStoredData`: only when the tab now stores exactly that body, for a conditional write (a swap)
// whose stats must land only if the write did.
export function tabStatsStatement(
  env: PlanEnv,
  tabId: string,
  stats: StoredTabStats,
  writtenAt: number,
  ifStoredData?: string,
): D1PreparedStatement {
  const guard =
    ifStoredData === undefined
      ? 'WHERE true'
      : 'WHERE EXISTS (SELECT 1 FROM tabs WHERE id = ?1 AND data = ?8)';
  return env.PLAN_DB.prepare(
    `INSERT INTO tab_stats (tab_id, mode, element_count, comment_count, data_bytes, written_at, kind)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 ${guard}
     ON CONFLICT(tab_id) DO UPDATE SET
       mode = excluded.mode,
       kind = excluded.kind,
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
    stats.kind,
    ...(ifStoredData === undefined ? [] : [ifStoredData]),
  );
}

// A project's stats as a `doc_stats` column: JSON text, or NULL when the project links no tab or
// a tab without stats. Reads `plan_tabs` and `tab_stats` only, never a tab body. The mode is
// the tab written last, ties to the earlier tab in the project's order.
export function projectStatsSql(projectIdSql: string): string {
  return `(SELECT CASE
             WHEN COUNT(*) = 0 OR COUNT(s.tab_id) < COUNT(*) THEN NULL
             ELSE json_object(
               'mode', (SELECT s2.mode
                          FROM plan_tabs dt2
                          JOIN tab_stats s2 ON s2.tab_id = dt2.tab_id
                         WHERE dt2.plan_id = ${projectIdSql}
                         ORDER BY s2.written_at DESC, dt2.order_index ASC
                         LIMIT 1),
               'elements', SUM(s.element_count),
               'comments', SUM(s.comment_count),
               'bytes', SUM(s.data_bytes))
           END
           FROM plan_tabs dt
           LEFT JOIN tab_stats s ON s.tab_id = dt.tab_id
          WHERE dt.plan_id = ${projectIdSql}) AS doc_stats`;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// The `doc_stats` column as the wire's ProjectStats; null when absent or unreadable.
export function readProjectStats(raw: string | null | undefined): ProjectStats | null {
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
