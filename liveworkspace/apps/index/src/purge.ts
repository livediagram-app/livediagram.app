// Purging (liveworkspace/docs/one-explorer-contracts.md "Purging"): a permanent delete, emptying the
// Trash, or the daily sweep of items 30 days in it. The index rows go at once, in one batch with a
// tombstone each (the item's other rows cascade); then the app is asked to drop the content. A tombstone
// stays until the app confirms, and the daily run retries it.

import { TRASH_RETENTION_MS, type App } from '@liveworkspace/index-client';
import { callApp, eachLimited } from './app-calls';
import { APP_CALL_CONCURRENCY, SWEEP_ITEMS_MAX, TOMBSTONES_PER_RUN } from './config';
import type { Env } from './env';

export type Purgeable = { id: string; app: App };

// Statements per D1 batch: two per item.
const ITEMS_PER_BATCH = 50;

export async function purgeRows(env: Env, items: Purgeable[], now = Date.now()): Promise<void> {
  const db = env.INDEX_DB;
  for (let i = 0; i < items.length; i += ITEMS_PER_BATCH) {
    const chunk = items.slice(i, i + ITEMS_PER_BATCH);
    await db.batch(
      chunk.flatMap((item) => [
        db
          .prepare(
            `INSERT INTO purge_tombstones (item_id, app, created_at) VALUES (?, ?, ?)
             ON CONFLICT (item_id) DO NOTHING`,
          )
          .bind(item.id, item.app, now),
        db.prepare('DELETE FROM items WHERE id = ?').bind(item.id),
      ]),
    );
  }
}

type TombstoneRow = { item_id: string; app: App };

// Asks each app to drop the content of tombstoned items: the given ones, or the longest-waiting. Returns
// how many the apps confirmed.
export async function drainTombstones(
  env: Env,
  options: { ids?: string[]; limit?: number } = {},
  now = Date.now(),
): Promise<number> {
  const db = env.INDEX_DB;
  const limit = options.limit ?? TOMBSTONES_PER_RUN;
  const { results } = options.ids
    ? await db
        .prepare(
          'SELECT item_id, app FROM purge_tombstones WHERE item_id IN (SELECT value FROM json_each(?)) LIMIT ?',
        )
        .bind(JSON.stringify(options.ids), limit)
        .all<TombstoneRow>()
    : await db
        .prepare('SELECT item_id, app FROM purge_tombstones ORDER BY last_attempt_at ASC LIMIT ?')
        .bind(limit)
        .all<TombstoneRow>();
  if (results.length === 0) return 0;

  const done: string[] = [];
  const failed: { id: string; error: string }[] = [];
  await eachLimited(results, APP_CALL_CONCURRENCY, async (row) => {
    const res = await callApp(env, row.app, 'DELETE', `/items/${encodeURIComponent(row.item_id)}`);
    if (res.ok) done.push(row.item_id);
    else failed.push({ id: row.item_id, error: res.error });
  });

  // One batch for every outcome.
  const statements = [
    ...done.map((id) => db.prepare('DELETE FROM purge_tombstones WHERE item_id = ?').bind(id)),
    ...failed.map((f) =>
      db
        .prepare(
          `UPDATE purge_tombstones SET attempts = attempts + 1, last_attempt_at = ?, last_error = ?
           WHERE item_id = ?`,
        )
        .bind(now, f.error, f.id),
    ),
  ];
  await db.batch(statements);
  if (failed.length > 0) {
    console.warn('[index] purge: apps unreachable, kept for the next run', {
      failed: failed.length,
      first: failed[0]?.error,
    });
  }
  return done.length;
}

// The daily run: items 30 days in the Trash, then every tombstone still waiting.
export async function sweep(
  env: Env,
  now = Date.now(),
): Promise<{ purged: number; confirmed: number }> {
  const { results } = await env.INDEX_DB.prepare(
    'SELECT id, app FROM items WHERE trashed_at IS NOT NULL AND trashed_at < ? ORDER BY trashed_at LIMIT ?',
  )
    .bind(now - TRASH_RETENTION_MS, SWEEP_ITEMS_MAX)
    .all<Purgeable>();
  await purgeRows(env, results, now);
  const confirmed = await drainTombstones(env, {}, now);
  await sweepLooseEvents(env);
  return { purged: results.length, confirmed };
}

// Timeline events about no item (a team's, a token's, images uploaded) that no scope sees any more (every
// person they reached has closed their account): at most this many a day.
export const LOOSE_EVENTS_SWEEP_MAX = 1000;

export async function sweepLooseEvents(env: Env): Promise<void> {
  await env.INDEX_DB.prepare(
    `DELETE FROM timeline_events WHERE rowid IN (
       SELECT e.rowid FROM timeline_events e WHERE e.item_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM timeline_event_scopes s WHERE s.event_id = e.id) LIMIT ?)`,
  )
    .bind(LOOSE_EVENTS_SWEEP_MAX)
    .run();
}
