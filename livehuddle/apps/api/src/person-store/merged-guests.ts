// The guests an account signed in from (docs/specs/012-collaboration/tab-attendance.md "Closing an account"; Work
// Tracker 730): their collab keys, one-way, never a guest id, kept in the account's person store so that closing the
// account anonymises the Attendance visits they made as a guest too. Recorded by the merge (db/account.ts mergeGuest),
// read by the person purge's anonymise door (routes/internal-items.ts), and kept MERGED_GUESTS_KEEP_MS past the
// account's purge so the index's retries still find them.

import type { ItemSql as PersonSql } from '@liveworkspace/index-app';
import { isCollabKey } from '@liveworkspace/api-schema/collab-key';

/** The most guest keys an account keeps: a guest per browser it signed in on. The oldest go first. */
export const MERGED_GUESTS_MAX = 32;
/** How long the keys outlast the account's purge: 8 days, a little past the index's week of purge retries. */
export const MERGED_GUESTS_KEEP_MS = 8 * 24 * 60 * 60 * 1000;

/** Record guest keys (those of a collab key's shape), keeping the newest MERGED_GUESTS_MAX. Idempotent. */
export function noteMergedGuests(sql: PersonSql, keys: readonly string[], now: number): number {
  let added = 0;
  for (const key of new Set(keys)) {
    if (!isCollabKey(key)) continue;
    const rows = sql
      .exec(
        'INSERT OR IGNORE INTO merged_guests (key, merged_at) VALUES (?, ?) RETURNING key',
        key,
        now,
      )
      .toArray();
    added += rows.length;
  }
  sql.exec(
    `DELETE FROM merged_guests WHERE key IN (
       SELECT key FROM merged_guests ORDER BY merged_at DESC, key LIMIT -1 OFFSET ?)`,
    MERGED_GUESTS_MAX,
  );
  return added;
}

/** Every guest key the account holds, newest first. */
export function listMergedGuests(sql: PersonSql): string[] {
  return sql
    .exec('SELECT key FROM merged_guests ORDER BY merged_at DESC, key')
    .toArray()
    .map((row) => String(row.key));
}
