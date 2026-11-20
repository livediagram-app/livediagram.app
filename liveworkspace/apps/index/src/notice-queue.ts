// The retry rule the index's notice queues share (liveworkspace/docs/specs/004-index/blueprints/trash.md "The shared
// retry", Work Tracker 1319): a closed account's notices (person-notices.ts), a guest's merges (person-merges.ts) and
// a revoked AI tool's notices (assistant-notices.ts) each keep their own table, payload, grouping and per-run budget,
// and tell the apps under one rule: a row is due when never tried or last tried NOTICE_RETRY_AFTER_MS ago, a call the
// app confirms (or an app this deployment does not run) deletes what it covered, any other outcome marks a try, and a
// row is given up NOTICE_GIVE_UP_MS after it was recorded.

import type { App } from '@liveworkspace/index-client';
import type { AppCallResult } from './app-calls';

export const NOTICE_RETRY_AFTER_MS = 60 * 60 * 1000;
export const NOTICE_GIVE_UP_MS = 7 * 24 * 60 * 60 * 1000;

// One queue: its table and its two log lines, literals in the queue's own file.
export type NoticeQueue = {
  table: 'person_app_notices' | 'person_app_merges' | 'assistant_notices';
  givenUp: string;
  notTaken: string;
};

// The rows a statement covers: each key column equal to its value and, given `items`, only those item_ids.
export type NoticeScope = {
  key: Readonly<{ app: App } & Record<string, string>>;
  items?: readonly string[];
};

// A row that is due, with dueBefore(now) bound in its place.
export const DUE_SQL = '(last_attempt_at IS NULL OR last_attempt_at < ?)';
export const dueBefore = (now: number) => now - NOTICE_RETRY_AFTER_MS;

function where(scope: NoticeScope): { sql: string; values: string[] } {
  const columns = Object.keys(scope.key);
  const parts = columns.map((column) => `${column} = ?`);
  const values = columns.map((column) => scope.key[column]!);
  if (scope.items) {
    parts.push('item_id IN (SELECT value FROM json_each(?))');
    values.push(JSON.stringify(scope.items));
  }
  return { sql: parts.join(' AND '), values };
}

// One batch: the rows recorded more than NOTICE_GIVE_UP_MS ago go, then `after` (a queue's own clean-up that reads
// what is left). Logs how many were given up.
export async function giveUpStale(
  db: D1Database,
  queue: NoticeQueue,
  now: number,
  ...after: D1PreparedStatement[]
): Promise<void> {
  const [stale] = await db.batch([
    db.prepare(`DELETE FROM ${queue.table} WHERE created_at < ?`).bind(now - NOTICE_GIVE_UP_MS),
    ...after,
  ]);
  const rows = stale!.meta.changes ?? 0;
  if (rows > 0) console.warn(queue.givenUp, { rows });
}

// Up to `limit` distinct `columns` (a queue's group, or its whole row) of the rows that are due.
export async function dueRows<T>(
  db: D1Database,
  queue: NoticeQueue,
  columns: string,
  limit: number,
  now: number,
): Promise<T[]> {
  const { results } = await db
    .prepare(`SELECT DISTINCT ${columns} FROM ${queue.table} WHERE ${DUE_SQL} LIMIT ?`)
    .bind(dueBefore(now), limit)
    .all<T>();
  return results;
}

// After one call: confirmed (or an app this deployment does not run, which has nothing to hear), the `confirm` rows
// go; else the `fail` rows get a try (attempts + 1, last_attempt_at) and the queue logs it. Returns whether confirmed.
export async function settle(
  db: D1Database,
  queue: NoticeQueue,
  outcome: AppCallResult,
  scopes: { confirm: NoticeScope; fail: NoticeScope },
  now: number,
): Promise<boolean> {
  if (outcome.ok || outcome.error === 'app_not_configured') {
    const { sql, values } = where(scopes.confirm);
    await db
      .prepare(`DELETE FROM ${queue.table} WHERE ${sql}`)
      .bind(...values)
      .run();
    return true;
  }
  const { sql, values } = where(scopes.fail);
  await db
    .prepare(`UPDATE ${queue.table} SET attempts = attempts + 1, last_attempt_at = ? WHERE ${sql}`)
    .bind(now, ...values)
    .run();
  console.warn(queue.notTaken, { app: scopes.fail.key.app, error: outcome.error });
  return false;
}
