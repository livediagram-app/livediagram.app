// Telling the apps a guest became an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Becoming an
// account"): the merge moves the index's own rows, but each app may keep something of the guest's beside their
// items (the images they uploaded, a per-person store), which only the app can move.
//
// The merge (merge.ts) records one row per app in its own batch. The merge request itself (at once, off its path)
// and the frequent cron send each app `POST /api/internal/people/:guest/merge {into}`; the row goes when the app
// confirms. An app that can't be reached is tried again an hour later, and given up on after a week (the shared
// retry, notice-queue.ts).
// A legacy merge (the migration's returning guest, merge.ts) is sent as `{into, legacy: true}`, since its `into` may
// be a guest; the row keeps the flag until the app confirms.

import { APPS, type App } from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import type { Env } from './env';
import { dueRows, giveUpStale, settle, type NoticeQueue } from './notice-queue';

// Rows tried per run: one app call each.
const MERGES_PER_RUN = 50;
const QUEUE: NoticeQueue = {
  table: 'person_app_merges',
  givenUp: '[index] person merges given up',
  notTaken: '[index] person merge not taken',
};

// The statement that records what each app must hear, in the merge's batch. The SELECT's `WHERE true` is SQLite's
// rule for an upsert from a SELECT: without one it reads ON as a join.
export function recordPersonMerges(
  db: D1Database,
  guest: string,
  user: string,
  now: number,
  legacy = false,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO person_app_merges (guest_id, user_id, app, created_at, legacy)
       SELECT ?1, ?2, value, ?3, ?5 FROM json_each(?4) WHERE true
       ON CONFLICT (guest_id, app) DO UPDATE
         SET user_id = excluded.user_id, legacy = excluded.legacy, attempts = 0, last_attempt_at = NULL`,
    )
    .bind(guest, user, now, JSON.stringify(APPS), legacy ? 1 : 0);
}

// In the same batch: rows still to tell the apps of an earlier merge into `guest` (a legacy chain: an old guest
// re-keyed, or claimed into a guest, which is then merged on) name `user` instead. The rows have no order, so
// without this an app told of the later merge first would be told of the earlier one after it, and move the
// earlier guest's things onto an id nobody holds any more. A chain that comes back on itself (`user` was merged into
// `guest`) has nothing left to tell: what the app keeps for `user` is still under `user`.
export function redirectPersonMerges(
  db: D1Database,
  guest: string,
  user: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare('DELETE FROM person_app_merges WHERE user_id = ?1 AND guest_id = ?2')
      .bind(guest, user),
    db.prepare('UPDATE person_app_merges SET user_id = ?2 WHERE user_id = ?1').bind(guest, user),
  ];
}

type MergeRow = { guest_id: string; user_id: string; app: App; legacy: number };

// One run: up to MERGES_PER_RUN due rows, one call each. Returns the rows confirmed.
export async function drainPersonMerges(env: Env, now = Date.now()): Promise<number> {
  const db = env.INDEX_DB;
  await giveUpStale(db, QUEUE, now);
  const results = await dueRows<MergeRow>(
    db,
    QUEUE,
    'guest_id, user_id, app, legacy',
    MERGES_PER_RUN,
    now,
  );
  let confirmed = 0;
  for (const row of results) {
    const outcome = await callApp(
      env,
      row.app,
      'POST',
      `/people/${encodeURIComponent(row.guest_id)}/merge`,
      row.legacy ? { into: row.user_id, legacy: true } : { into: row.user_id },
    );
    // Confirmed, the row goes only while it still names the account sent (a guest merged again meanwhile keeps the
    // new row to tell); a failure marks the (guest, app) row.
    const key = { guest_id: row.guest_id, app: row.app };
    const scopes = { confirm: { key: { ...key, user_id: row.user_id } }, fail: { key } };
    if (await settle(db, QUEUE, outcome, scopes, now)) confirmed++;
  }
  return confirmed;
}
