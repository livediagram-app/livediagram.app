// tab_attendance: a tab's visits, one row per person per stretch in the tab, in the document's own SQLite
// (docs/specs/012-collaboration/tab-attendance.md; blueprint "Data and persistence", "Behaviour and state"). Written by
// the room as its sockets come and go (document-room/room-attendance.ts), synchronously on its SqlStorage; read by
// the attendance route and swept by the daily upkeep through the D1-shaped DOCUMENT_DB.

import {
  ATTENDANCE_REJOIN_GRACE_MS,
  ATTENDANCE_RETENTION_MS,
  ATTENDANCE_TAB_MAX,
} from '@livehuddle/api-schema';

/** The slice of a Durable Object's SqlStorage these writes use. */
export type AttendanceSql = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};

/** Who is joining, as the room's session showed them. */
export type AttendanceWho = { name: string; color: string; picture: string | null; guest: boolean };

/** A stored visit, as the route reads it. */
export type AttendanceRow = {
  id: number;
  person_key: string;
  name: string;
  color: string;
  picture: string | null;
  guest: number;
  joined_at: number;
  left_at: number | null;
};

/**
 * The person's visit to the tab begins, or carries on: an open one (left open by a restart the sweep has not reached)
 * is refreshed, one closed within the rejoin grace is reopened, and otherwise a new visit is inserted and the tab is
 * pruned to its cap and its retention. Returns what it did.
 */
export function joinVisit(
  sql: AttendanceSql,
  tabId: string,
  key: string,
  who: AttendanceWho,
  now: number,
): 'open' | 'reopened' | 'inserted' {
  const latest = sql
    .exec(
      `SELECT id, left_at, closed_at FROM tab_attendance
        WHERE person_key = ? AND tab_id = ? ORDER BY id DESC LIMIT 1`,
      key,
      tabId,
    )
    .toArray()[0] as { id: number; left_at: number | null; closed_at: number | null } | undefined;
  if (latest && latest.left_at === null) {
    sql.exec(
      'UPDATE tab_attendance SET name = ?, color = ?, picture = ?, seen_at = ? WHERE id = ?',
      who.name,
      who.color,
      who.picture,
      now,
      latest.id,
    );
    return 'open';
  }
  if (latest && latest.closed_at !== null && now - latest.closed_at <= ATTENDANCE_REJOIN_GRACE_MS) {
    sql.exec(
      `UPDATE tab_attendance SET left_at = NULL, closed_at = NULL, name = ?, color = ?, picture = ?, seen_at = ?
        WHERE id = ?`,
      who.name,
      who.color,
      who.picture,
      now,
      latest.id,
    );
    return 'reopened';
  }
  sql.exec(
    `INSERT INTO tab_attendance (tab_id, person_key, name, color, picture, guest, joined_at, seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tabId,
    key,
    who.name,
    who.color,
    who.picture,
    who.guest ? 1 : 0,
    now,
    now,
  );
  pruneTab(sql, tabId, now);
  return 'inserted';
}

/** The person's last connection on the tab has gone: their open visit there ends now. */
export function leaveVisit(sql: AttendanceSql, tabId: string, key: string, now: number): void {
  sql.exec(
    `UPDATE tab_attendance SET left_at = ?, closed_at = ?, seen_at = ?
      WHERE person_key = ? AND tab_id = ? AND left_at IS NULL`,
    now,
    now,
    now,
    key,
    tabId,
  );
}

/** Every open visit was seen now (the room wrote attendance, so each open one is someone still connected). */
export function touchOpenVisits(sql: AttendanceSql, now: number): void {
  sql.exec('UPDATE tab_attendance SET seen_at = ? WHERE left_at IS NULL', now);
}

/**
 * The room starts with nobody connected, so every visit still open lost its close (a deploy ends every socket without
 * telling the room): each ends when the room last saw it, and its grace runs from now. Returns how many.
 */
export function closeStaleVisits(sql: AttendanceSql, now: number): number {
  const closed = sql
    .exec(
      `UPDATE tab_attendance SET left_at = seen_at, closed_at = ? WHERE left_at IS NULL RETURNING id`,
      now,
    )
    .toArray();
  return closed.length;
}

/** Whether the document's SQLite has the table yet (a room from before it reads as having no visits). */
export function hasAttendanceTable(sql: AttendanceSql): boolean {
  return (
    sql
      .exec("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'tab_attendance'")
      .toArray().length > 0
  );
}

// The tab's visits past its cap (oldest first) and its closed ones past retention.
function pruneTab(sql: AttendanceSql, tabId: string, now: number): void {
  sql.exec(
    `DELETE FROM tab_attendance WHERE id IN (
       SELECT id FROM tab_attendance WHERE tab_id = ? ORDER BY id DESC LIMIT -1 OFFSET ?)`,
    tabId,
    ATTENDANCE_TAB_MAX,
  );
  sql.exec(
    'DELETE FROM tab_attendance WHERE tab_id = ? AND left_at IS NOT NULL AND left_at < ?',
    tabId,
    now - ATTENDANCE_RETENTION_MS,
  );
}

/** The tab's visits a reader may see, newest first: at most the cap, none ended before retention. */
export async function listVisits(
  db: D1Database,
  tabId: string,
  now: number,
): Promise<AttendanceRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, person_key, name, color, picture, guest, joined_at, left_at FROM tab_attendance
        WHERE tab_id = ? AND (left_at IS NULL OR left_at >= ?)
        ORDER BY joined_at DESC, id DESC LIMIT ?`,
    )
    .bind(tabId, now - ATTENDANCE_RETENTION_MS, ATTENDANCE_TAB_MAX)
    .all<AttendanceRow>();
  return results;
}

/** The daily upkeep's share: every closed visit past retention, in every tab. Returns how many went. */
export async function deleteOldVisits(db: D1Database, now: number): Promise<number> {
  const res = await db
    .prepare('DELETE FROM tab_attendance WHERE left_at IS NOT NULL AND left_at < ?')
    .bind(now - ATTENDANCE_RETENTION_MS)
    .run();
  return res.meta.changes ?? 0;
}
