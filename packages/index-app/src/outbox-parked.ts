// The outbox's parked keys (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "When a push fails"): a key
// refused for good, or failed OUTBOX_MAX_ATTEMPTS times, is parked by outbox.ts settleOutbox and left out of every
// drain. This module lets parked keys back in once the index is healthy again, and keeps them bounded:
//
//   - Retried after a healthy drain: a drain in which every push succeeded lets each parked key whose wait is over
//     (`retry_at`, which parking sets PARKED_RETRY_MS ahead) back in for one more try in the next drain. One that
//     fails is parked again at once, so a key the index keeps refusing goes at most once a day, never in a loop.
//   - Bounded: a row parked more than PARKED_KEEP_MS ago (`parked_at`, stamped the first time a settle sees it parked)
//     is dropped, and an item keeps at most its newest PARKED_KEEP_MAX parked rows.
//
// An app runs outboxParkingStep as a schema step of its room, then calls tendParkedOutbox after each settleOutbox.

import { OUTBOX_MAX_ATTEMPTS, type OutboxDb, type OutboxFailure, type OutboxTable } from './outbox';

// How long a parked row is kept, from when it was first parked: past it, the thing it owed is long stale.
export const PARKED_KEEP_MS = 30 * 24 * 60 * 60_000;
// The most parked rows an item keeps (its newest): a lasting refusal of a plan's card moves cannot grow the table
// without end, and a healthy drain lets back in no more than a few drains' worth.
export const PARKED_KEEP_MAX = 500;

// The schema callback an app's room migration hands a step (no bindings: a plain statement at a time).
export type SchemaExec = (query: string) => { toArray(): Record<string, unknown>[] };

// The columns the outbox's retry and parking need, with their SQL.
const PARKING_COLUMNS: readonly (readonly [string, string])[] = [
  ['attempts', 'INTEGER NOT NULL DEFAULT 0'],
  ['retry_at', 'INTEGER NOT NULL DEFAULT 0'],
  ['parked_at', 'INTEGER NOT NULL DEFAULT 0'],
];

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

// The schema step that gives an app's outbox its parking: `parked_at` (and `attempts` and `retry_at` where the room
// lacks them, as one whose version row ran ahead of its columns can), the `(attempts, retry_at)` index the next-due
// read and the parked-row statements use, and the time it runs on every row parked already, so those are dropped
// PARKED_KEEP_MS on. It asks SQLite which columns exist before each ALTER, so it is safe on any room; the app's version
// row runs it once.
export function outboxParkingStep(exec: SchemaExec, table = 'outbox'): void {
  if (!IDENTIFIER.test(table)) throw new Error(`outboxParkingStep: bad table name ${table}`);
  const have = new Set(
    exec(`PRAGMA table_info(${table})`)
      .toArray()
      .map((c) => String(c.name)),
  );
  for (const [column, type] of PARKING_COLUMNS)
    if (!have.has(column)) exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  exec(`CREATE INDEX IF NOT EXISTS ${table}_due ON ${table} (attempts, retry_at)`);
  exec(
    `UPDATE ${table} SET parked_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
      WHERE attempts >= ${OUTBOX_MAX_ATTEMPTS} AND parked_at = 0`,
  );
}

// A drain the index answered in full: no push failed, and at least one key was done.
export const healthyDrain = (outcome: {
  done: readonly number[];
  failed: readonly OutboxFailure[];
}): boolean => outcome.failed.length === 0 && outcome.done.length > 0;

// After settleOutbox at `now`, in one batch: drops parked rows first parked past PARKED_KEEP_MS; when the settle parked
// keys (`parked`, its answer), stamps them and keeps the newest PARKED_KEEP_MAX; and, after a healthy drain, lets back
// in each parked key whose wait is over, with one try left (the next drain sends it at the usual pace; the room's
// next-due read finds it). Answers how many rows it dropped and let back in, each with a log line.
//
// A parked row's `attempts` is exactly OUTBOX_MAX_ATTEMPTS (settleOutbox never counts past it), so the let-back-in
// statement seeks the `(attempts, retry_at)` index to the keys due; only the age check reads every parked row, at most
// PARKED_KEEP_MAX of them, and a drain runs at most once a minute.
export async function tendParkedOutbox(
  db: OutboxDb,
  outbox: OutboxTable,
  itemId: string,
  drain: { done: readonly number[]; failed: readonly OutboxFailure[]; parked: number },
  now: number,
): Promise<{ dropped: number; unparked: number }> {
  const { table, itemColumn } = outbox;
  const parked = `${itemColumn} = ? AND attempts = ${OUTBOX_MAX_ATTEMPTS}`;
  const statements: { kind: 'stamp' | 'drop' | 'unpark'; statement: D1PreparedStatement }[] = [];
  if (drain.parked > 0)
    statements.push({
      kind: 'stamp',
      statement: db
        .prepare(`UPDATE ${table} SET parked_at = ? WHERE ${parked} AND parked_at = 0`)
        .bind(now, itemId),
    });
  statements.push({
    kind: 'drop',
    statement: db
      .prepare(`DELETE FROM ${table} WHERE ${parked} AND parked_at > 0 AND parked_at <= ?`)
      .bind(itemId, now - PARKED_KEEP_MS),
  });
  if (drain.parked > 0)
    statements.push({
      kind: 'drop',
      // At and below the PARKED_KEEP_MAX+1-th newest parked row's id; none (NULL matches nothing) while fewer.
      statement: db
        .prepare(
          `DELETE FROM ${table} WHERE ${parked} AND id <=
            (SELECT id FROM ${table} WHERE ${parked} ORDER BY id DESC LIMIT 1 OFFSET ?)`,
        )
        .bind(itemId, itemId, PARKED_KEEP_MAX),
    });
  if (healthyDrain(drain))
    statements.push({
      kind: 'unpark',
      statement: db
        .prepare(`UPDATE ${table} SET attempts = ?, retry_at = 0 WHERE ${parked} AND retry_at <= ?`)
        .bind(OUTBOX_MAX_ATTEMPTS - 1, itemId, now),
    });
  const results = await db.batch(statements.map((s) => s.statement));
  let dropped = 0;
  let unparked = 0;
  statements.forEach((s, i) => {
    const changes = Number(results[i]?.meta?.changes ?? 0);
    if (s.kind === 'drop') dropped += changes;
    else if (s.kind === 'unpark') unparked += changes;
  });
  if (dropped > 0) console.warn('[outbox] parked rows dropped', { itemId, keys: dropped });
  if (unparked > 0) console.info('[outbox] unparked', { itemId, keys: unparked });
  return { dropped, unparked };
}
