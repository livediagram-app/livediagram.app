// What a knowledgebase's alarm owes (`knowledge_work`, knowledge-schema.ts): a conflict check after a save or a
// Verify, and the review check that emails owners of pages come due (one row, `review-email` / `daily`). A row a kind and key, so asking twice is one piece of work,
// and a turn of the alarm does what is due and answers when the next is.
import type { ItemSql } from '@liveworkspace/index-app';

// `watch` (watching.md): key `inbox`, the updates' push; key `daily`, the reach check and the digests (watch-work.ts).
export type WorkKind = 'conflict' | 'review-email' | 'watch';
export type Work = { kind: WorkKind; key: string; dueAt: number; payload: string };

/** Owe a piece of work at `dueAt`; one already owed keeps its earlier time and its own payload (a conflict check's
 *  is the page as it stood before the first of several saves). */
export function oweWork(sql: ItemSql, work: Work): void {
  sql.exec(
    `INSERT INTO knowledge_work (kind, key, due_at, payload) VALUES (?, ?, ?, ?)
       ON CONFLICT (kind, key) DO UPDATE SET due_at = MIN(due_at, excluded.due_at),
         payload = CASE WHEN knowledge_work.payload = '' THEN excluded.payload ELSE knowledge_work.payload END`,
    work.kind,
    work.key,
    work.dueAt,
    work.payload,
  );
}

/** The work due at `now`, oldest first, at most `limit`. */
export function dueWork(sql: ItemSql, now: number, limit: number): Work[] {
  return sql
    .exec(
      `SELECT kind, key, due_at AS dueAt, payload FROM knowledge_work
        WHERE due_at <= ? ORDER BY due_at ASC LIMIT ?`,
      now,
      limit,
    )
    .toArray() as Work[];
}

export function doneWork(sql: ItemSql, kind: WorkKind, key: string): void {
  sql.exec('DELETE FROM knowledge_work WHERE kind = ? AND key = ?', kind, key);
}

/** When the next piece of work is due; null for none, or for a room with no knowledge tables yet. */
export function knowledgeWorkDueAt(sql: ItemSql): number | null {
  const row = sql.exec('SELECT MIN(due_at) AS at FROM knowledge_work').toArray()[0];
  return typeof row?.at === 'number' ? row.at : null;
}

/** Put a piece of work off until `dueAt`. */
export function deferWork(sql: ItemSql, kind: WorkKind, key: string, dueAt: number): void {
  sql.exec('UPDATE knowledge_work SET due_at = ? WHERE kind = ? AND key = ?', dueAt, kind, key);
}
