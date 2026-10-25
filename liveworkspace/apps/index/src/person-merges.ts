// Telling the apps a guest became an account (liveworkspace/docs/one-explorer-contracts.md "Becoming an
// account"): the merge moves the index's own rows, but each app may keep something of the guest's beside their
// items (the images they uploaded, a per-person store), which only the app can move.
//
// The merge (merge.ts) records one row per app in its own batch. The merge request itself (at once, off its path)
// and the frequent cron send each app `POST /api/internal/people/:guest/merge {into}`; the row goes when the app
// confirms. An app that can't be reached is tried again an hour later, and given up on after NOTICE_GIVE_UP_MS.

import { APPS, type App } from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import type { Env } from './env';
import { NOTICE_GIVE_UP_MS, NOTICE_RETRY_AFTER_MS } from './person-notices';

// Rows tried per run: one app call each.
const MERGES_PER_RUN = 50;

// The statement that records what each app must hear, in the merge's batch. The SELECT's `WHERE true` is SQLite's
// rule for an upsert from a SELECT: without one it reads ON as a join.
export function recordPersonMerges(
  db: D1Database,
  guest: string,
  user: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO person_app_merges (guest_id, user_id, app, created_at)
       SELECT ?1, ?2, value, ?3 FROM json_each(?4) WHERE true
       ON CONFLICT (guest_id, app) DO UPDATE
         SET user_id = excluded.user_id, attempts = 0, last_attempt_at = NULL`,
    )
    .bind(guest, user, now, JSON.stringify(APPS));
}

type MergeRow = { guest_id: string; user_id: string; app: App };

// One run: up to MERGES_PER_RUN due rows, one call each. Returns the rows confirmed.
export async function drainPersonMerges(env: Env, now = Date.now()): Promise<number> {
  const db = env.INDEX_DB;
  const stale = await db
    .prepare('DELETE FROM person_app_merges WHERE created_at < ?')
    .bind(now - NOTICE_GIVE_UP_MS)
    .run();
  if ((stale.meta.changes ?? 0) > 0) {
    console.warn('[index] person merges given up', { rows: stale.meta.changes });
  }
  const { results } = await db
    .prepare(
      `SELECT guest_id, user_id, app FROM person_app_merges
        WHERE last_attempt_at IS NULL OR last_attempt_at < ? LIMIT ?`,
    )
    .bind(now - NOTICE_RETRY_AFTER_MS, MERGES_PER_RUN)
    .all<MergeRow>();
  let confirmed = 0;
  for (const row of results) {
    const outcome = await callApp(
      env,
      row.app,
      'POST',
      `/people/${encodeURIComponent(row.guest_id)}/merge`,
      { into: row.user_id },
    );
    // An app this deployment does not run has nothing to hear.
    if (outcome.ok || outcome.error === 'app_not_configured') {
      await db
        .prepare('DELETE FROM person_app_merges WHERE guest_id = ? AND app = ? AND user_id = ?')
        .bind(row.guest_id, row.app, row.user_id)
        .run();
      confirmed++;
    } else {
      await db
        .prepare(
          `UPDATE person_app_merges SET attempts = attempts + 1, last_attempt_at = ?
            WHERE guest_id = ? AND app = ?`,
        )
        .bind(now, row.guest_id, row.app)
        .run();
      console.warn('[index] person merge not taken', { app: row.app, error: outcome.error });
    }
  }
  return confirmed;
}
