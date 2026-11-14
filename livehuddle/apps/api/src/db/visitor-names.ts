// visitor_names: the name each browser with no identity typed in the join dialog, by its collab key, in the
// document's own SQLite (docs/specs/014-identity/auth-and-guest-access.md "Presence names"; schema V8). A link visitor
// has no participant record to keep it in, so the room keeps it, and names the browser by it on every later hello: a
// reload keeps the name. Read and written synchronously on the room's SqlStorage, like tab_attendance.

import type { AttendanceSql } from './tab-attendance';

// The names one document keeps at most; the oldest go first. A name is a few dozen bytes, so ~100 KB at most, and a
// client minting a new browser secret per connection cannot grow the table without bound.
export const VISITOR_NAMES_MAX = 1000;

/** The name this browser's key was given, or null. */
export function readVisitorName(sql: AttendanceSql, key: string): string | null {
  const row = sql
    .exec('SELECT name FROM visitor_names WHERE person_key = ? LIMIT 1', key)
    .toArray()[0];
  return typeof row?.name === 'string' && row.name ? row.name : null;
}

/** Keep the name this browser's key typed, replacing any it had. */
export function writeVisitorName(sql: AttendanceSql, key: string, name: string, now: number): void {
  sql.exec(
    `INSERT INTO visitor_names (person_key, name, named_at) VALUES (?, ?, ?)
       ON CONFLICT (person_key) DO UPDATE SET name = excluded.name, named_at = excluded.named_at`,
    key,
    name,
    now,
  );
  sql.exec(
    `DELETE FROM visitor_names WHERE person_key IN
       (SELECT person_key FROM visitor_names ORDER BY named_at DESC, person_key LIMIT -1 OFFSET ?)`,
    VISITOR_NAMES_MAX,
  );
}
