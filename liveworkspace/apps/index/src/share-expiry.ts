// Share Link Expiring (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): a warning on an item owner's
// Timeline before its share links stop working. One event per item (`sx:<item>`), dated at the soonest expiry
// among its live links that lapse within SHARE_EXPIRY_WARNING_MS, so it sits in the Upcoming band above Today
// until then; seen by the owner alone, as who an item is shared with is theirs to manage.
//
// Written at once when a link is made, extended or deleted (the item's warning is worked out again: dropped, then
// written if a link is still inside the week), and by the daily pass, which catches links the week has reached
// since. The daily pass only writes or moves warnings, so one the owner removed from their Timeline stays removed
// until a link changes. A warning whose link lapsed stays where it was, as what happened.

import { SHARE_EXPIRY_WARNING_MS } from '@liveworkspace/index-client';
import type { Env } from './env';

type Db = D1Database;

// Items one daily pass warns about, soonest first; any more wait for the next day, a day nearer.
export const EXPIRY_SWEEP_MAX = 2_000;
// Items per statement in the daily pass.
const EXPIRY_CHUNK = 500;

export const expiringEventId = (itemId: string) => `sx:${itemId}`;

// The warning for each listed item with a live link lapsing in the window, written or moved to its soonest expiry,
// and its owner's scope row with it. Two statements, whatever the count.
function writeStatements(db: Db, itemIds: readonly string[], now: number): D1PreparedStatement[] {
  const ids = JSON.stringify(itemIds);
  return [
    db
      .prepare(
        `INSERT INTO timeline_events (id, app, item_id, actor_id, type, title, detail, occurred_at)
         SELECT 'sx:' || i.id, i.app, i.id, NULL, 'share_link_expiring', i.title,
           json_object('expiresAt', CAST(MIN(sl.expires_at) AS TEXT), 'links', CAST(COUNT(*) AS TEXT)),
           MIN(sl.expires_at)
         FROM items i JOIN share_links sl ON sl.item_id = i.id
         WHERE i.id IN (SELECT value FROM json_each(?1)) AND i.trashed_at IS NULL
           AND sl.expires_at > ?2 AND sl.expires_at <= ?3
         GROUP BY i.id
         ON CONFLICT (id) DO UPDATE SET occurred_at = excluded.occurred_at, title = excluded.title,
           detail = excluded.detail`,
      )
      .bind(ids, now, now + SHARE_EXPIRY_WARNING_MS),
    db
      .prepare(
        `INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at)
         SELECT 'p:' || i.owner_id, e.id, e.app, e.occurred_at
         FROM timeline_events e JOIN items i ON i.id = e.item_id
         WHERE e.id IN (SELECT 'sx:' || value FROM json_each(?))
         ON CONFLICT (scope, event_id) DO UPDATE SET occurred_at = excluded.occurred_at`,
      )
      .bind(ids),
  ];
}

/** The statements that work an item's warning out again after one of its links changed: dropped, then written if a
 *  live link still lapses within the week. They go in the batch that makes the change. */
export function expiringStatements(db: Db, itemId: string, now: number): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM timeline_events WHERE id = ?').bind(expiringEventId(itemId)),
    ...writeStatements(db, [itemId], now),
  ];
}

/** The daily pass: a warning for every item whose live links lapse within the week (at most EXPIRY_SWEEP_MAX, the
 *  soonest first). One read through share_links' expiry index, then two statements per EXPIRY_CHUNK items. */
export async function sweepExpiringLinks(env: Env, now = Date.now()): Promise<number> {
  const db = env.INDEX_DB;
  const { results } = await db
    .prepare(
      `SELECT item_id FROM share_links WHERE expires_at > ? AND expires_at <= ?
       GROUP BY item_id ORDER BY MIN(expires_at) LIMIT ?`,
    )
    .bind(now, now + SHARE_EXPIRY_WARNING_MS, EXPIRY_SWEEP_MAX)
    .all<{ item_id: string }>();
  const ids = results.map((r) => r.item_id);
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < ids.length; i += EXPIRY_CHUNK) {
    statements.push(...writeStatements(db, ids.slice(i, i + EXPIRY_CHUNK), now));
  }
  if (statements.length > 0) await db.batch(statements);
  return ids.length;
}
