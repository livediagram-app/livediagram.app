// Spaces made by Call (liveworkspace/docs/specs/004-index/item-calls.md "When a call ends", Work Tracker 1445): a Space
// the index made for one call goes to the Trash once that call has been live and stood empty past
// ITEM_CALL_START_GRACE_MS. The gate is the call row's `made` mark alone, never a Space's name or template: only
// startCall sets it, and every way its owner makes the Space their own clears it (keepMadeSpace).

import {
  ITEM_CALL_APP,
  ITEM_CALL_START_GRACE_MS,
  ITEM_CALL_SWEEP_MAX,
} from '@liveworkspace/index-client';
import { sendDriveSignals, type DriveTouched } from './drive';
import type { Env } from './env';
import { eventStatements } from './events';
import { afterTrashed } from './items/trash';

/** The statement that takes the made-by-Call mark off every call row of `spaceId`: its owner made it their own
 *  (renamed, moved, archived, restored, chosen as their Calls Space). Any item: a non-Space matches nothing. */
export const keepMadeSpace = (db: D1Database, spaceId: string): D1PreparedStatement =>
  db.prepare('UPDATE item_calls SET made = 0 WHERE space_id = ? AND made = 1').bind(spaceId);

type Ended = {
  call_id: string;
  space_id: string;
  owner_id: string;
  team_id: string | null;
};

// A marked call that has been live, is empty, and ended before `cutoff`, still its Space's newest row. Shared by the
// read and the move's own check, so a rejoin between them moves nothing.
const ENDED = `c.made = 1 AND c.live_at IS NOT NULL AND c.ended_at IS NOT NULL AND c.ended_at < ?1 AND c.people = 0
  AND NOT EXISTS (SELECT 1 FROM item_calls n WHERE n.space_id = c.space_id AND n.started_at > c.started_at)`;

/** The quarter-hourly run: each Space made by Call whose call has ended goes to the Trash as an Explorer Delete puts it
 *  there, at most `max` a run. Answers how many moved. */
export async function sweepMadeSpaces(
  env: Env,
  now = Date.now(),
  max = ITEM_CALL_SWEEP_MAX,
): Promise<number> {
  const db = env.INDEX_DB;
  const cutoff = now - ITEM_CALL_START_GRACE_MS;
  const { results } = await db
    .prepare(
      `SELECT c.id AS call_id, c.space_id, i.owner_id, i.team_id
       FROM item_calls c JOIN items i ON i.id = c.space_id
       WHERE ${ENDED} AND i.app = ?2 AND i.trashed_at IS NULL AND i.archived_at IS NULL
       ORDER BY c.ended_at LIMIT ?3`,
    )
    .bind(cutoff, ITEM_CALL_APP, max)
    .all<Ended>();
  if (results.length === 0) return 0;
  const pending: Promise<unknown>[] = [];
  const drive: DriveTouched = new Set();
  let moved = 0;
  for (const found of results) {
    // The move checks it all again in the one statement: still marked, still ended past the grace, still empty.
    const trashed = await db
      .prepare(
        `UPDATE items SET trashed_at = ?2, trash_reason = 'deleted'
         WHERE id = ?3 AND app = ?4 AND trashed_at IS NULL AND archived_at IS NULL
           AND EXISTS (SELECT 1 FROM item_calls c WHERE c.id = ?5 AND c.space_id = ?3 AND ${ENDED})
         RETURNING id`,
      )
      .bind(cutoff, now, found.space_id, ITEM_CALL_APP, found.call_id)
      .first<{ id: string }>();
    if (!trashed) continue;
    moved += 1;
    await db.batch([
      ...eventStatements(db, { itemId: found.space_id, type: 'trashed', actorId: null, at: now }),
      // In the Trash it is no longer made by Call: restoring it keeps it.
      keepMadeSpace(db, found.space_id),
    ]);
    afterTrashed(
      env,
      (p) => pending.push(p),
      drive,
      {
        id: found.space_id,
        app: ITEM_CALL_APP,
        owner_id: found.owner_id,
        team_id: found.team_id,
        archived_at: null,
      },
      now,
    );
  }
  await Promise.allSettled(pending);
  await sendDriveSignals(env, drive, now);
  return moved;
}
