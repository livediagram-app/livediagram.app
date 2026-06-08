// change_log — per-diagram audit log (migration 0004). Row shape and
// the denormalisation fallback live in change-log-row.ts (so the
// pure mapper has its own test surface); D1 queries here use them.

import { CHANGE_LOG_LIST_LIMIT } from '@livediagram/api-schema';
import { rowToChangeLog, type ChangeLogRow } from '../change-log-row';
import type { ChangeLogEntryDTO, Env } from '../types';

// Per-diagram log read: change_log.diagram_id was dropped in
// migration 0012 (item #14), so the filter joins through
// diagram_tabs to find every tab currently linked to the diagram
// and pulls log entries for those tabs. A tab shared between
// diagrams surfaces in both diagrams' logs — which is the right
// answer once spec/17's many-to-many tabs land: the change exists
// in every diagram it shows up in.
export async function listChangeLog(env: Env, diagramId: string): Promise<ChangeLogEntryDTO[]> {
  // LEFT JOIN through participants so rows whose author has been
  // deleted (account delete) still surface, with a fallback name
  // and colour from rowToChangeLog. Inner join would silently hide
  // those entries.
  const result = await env.DB.prepare(
    `SELECT cl.id, cl.tab_id, cl.participant_id,
            p.name  AS participant_name,
            p.color AS participant_color,
            cl.kind, cl.summary, cl.element_ids, cl.before_state, cl.after_state, cl.created_at
       FROM change_log cl
       JOIN diagram_tabs dt ON dt.tab_id = cl.tab_id
       LEFT JOIN participants p ON p.id = cl.participant_id
      WHERE dt.diagram_id = ?
      ORDER BY cl.created_at DESC
      LIMIT ?`,
  )
    .bind(diagramId, CHANGE_LOG_LIST_LIMIT)
    .all<ChangeLogRow>();
  return (result.results ?? []).map(rowToChangeLog);
}

export async function insertChangeLogEntry(env: Env, entry: ChangeLogEntryDTO): Promise<void> {
  // Post-migration 0013: participant_name + _color columns are gone.
  // The DTO still carries them so the WebSocket op + UI can keep
  // showing the author cheaply — we just don't write them to D1.
  await env.DB.prepare(
    `INSERT INTO change_log (
       id, tab_id, participant_id,
       kind, summary, element_ids, before_state, after_state, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      entry.id,
      entry.tabId,
      entry.participantId,
      entry.kind,
      entry.summary,
      JSON.stringify(entry.elementIds),
      JSON.stringify(entry.beforeState),
      JSON.stringify(entry.afterState),
      entry.createdAt,
    )
    .run();
}

// Bulk-drop every log entry for a tab. Used by the live app when it
// deletes a tab — the tab no longer exists, its history is dead with
// it. See specs/12-activity-and-audit.md. The delete is SCOPED to the
// caller's diagram (via diagram_tabs): migration 0012 dropped
// change_log.diagram_id, so a bare `WHERE tab_id = ?` would let an
// owner of one diagram wipe a foreign diagram's tab log by id (IDOR).
// Requiring the tab to be linked to `diagramId` (which the route has
// already authorised) closes that.
export async function deleteChangeLogForTab(
  env: Env,
  diagramId: string,
  tabId: string,
): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM change_log
      WHERE tab_id = ?
        AND tab_id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id = ?)`,
  )
    .bind(tabId, diagramId)
    .run();
}

// Drop a single log entry. Used by the live app when the user clicks
// Revert — the original entry vanishes rather than gaining a
// 'reverted' counterpart, so the log stays compact. SCOPED to the
// caller's diagram for the same reason as deleteChangeLogForTab: the
// entry id alone is not diagram-bound post-0012, so the delete must
// confirm the entry's tab belongs to the authorised diagram.
export async function deleteChangeLogEntry(
  env: Env,
  diagramId: string,
  entryId: string,
): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM change_log
      WHERE id = ?
        AND tab_id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id = ?)`,
  )
    .bind(entryId, diagramId)
    .run();
}

// 90-day retention sweep — fired from the scheduled handler (item
// #16 / spec/12). The Activity Panel only ever surfaces the most
// recent CHANGE_LOG_LIST_LIMIT entries, so anything older than the
// retention window has been invisible since the day it landed.
// Keeping it around forever was a slow leak.
//
// Returns the row count deleted so the scheduled handler can log
// it for observability.
export async function deleteOldChangeLogEntries(env: Env, cutoffMs: number): Promise<number> {
  const result = await env.DB.prepare('DELETE FROM change_log WHERE created_at < ?')
    .bind(cutoffMs)
    .run();
  return result.meta.changes ?? 0;
}
