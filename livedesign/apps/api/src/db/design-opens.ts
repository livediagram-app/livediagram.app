// design_opens — Explorer Home's last opens (the baseline migration,
// docs/specs/013-workspace/explorer-home.md "Opens"; blueprint "Data and persistence"). One row per
// person per design they have opened: the last open, which Jump back in's Recent reads, and its
// UTC day, which gates the day's one `design_opened` event (the open-day record Most used counts).

import type { Env } from '../types';

type DesignOpen = { lastOpenedAt: number; lastOpenDay: string };

export async function getDesignOpen(
  env: Env,
  ownerId: string,
  designId: string,
): Promise<DesignOpen | null> {
  const row = await env.DB.prepare(
    `SELECT last_opened_at, last_open_day FROM design_opens
      WHERE owner_id = ?1 AND design_id = ?2`,
  )
    .bind(ownerId, designId)
    .first<{ last_opened_at: number; last_open_day: string }>();
  return row ? { lastOpenedAt: row.last_opened_at, lastOpenDay: row.last_open_day } : null;
}

// Count one open day. The update only lands when the stored day is EARLIER than this one, so of
// two requests racing to record the same day exactly one writes. Returns whether this call did.
export async function recordOpenDay(
  env: Env,
  ownerId: string,
  designId: string,
  open: { at: number; day: string },
): Promise<boolean> {
  const res = await env.DB.prepare(
    `INSERT INTO design_opens (owner_id, design_id, last_opened_at, last_open_day)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (owner_id, design_id) DO UPDATE SET
       last_opened_at = excluded.last_opened_at,
       last_open_day = excluded.last_open_day
     WHERE design_opens.last_open_day < excluded.last_open_day`,
  )
    .bind(ownerId, designId, open.at, open.day)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// A later open on a day already counted: only the last open moves, and never backwards.
export async function touchLastOpen(
  env: Env,
  ownerId: string,
  designId: string,
  at: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE design_opens SET last_opened_at = ?3
      WHERE owner_id = ?1 AND design_id = ?2 AND last_opened_at < ?3`,
  )
    .bind(ownerId, designId, at)
    .run();
}

// Account deletion: the person's opens go. Other people's opens of the account's designs go
// with the designs (the foreign key cascades).
export async function deleteDesignOpensForOwner(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM design_opens WHERE owner_id = ?1').bind(ownerId).run();
}

// Sign-up migration. Every row the account does not already hold moves as it is; a design
// opened under both identities keeps the later open. (Its open days are events, which move with
// the rest of the Timeline, so the use days are the days of either.)
export async function migrateDesignOpens(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ moved: number; merged: number }> {
  const moved = await env.DB.prepare(
    'UPDATE OR IGNORE design_opens SET owner_id = ?1 WHERE owner_id = ?2',
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  // What is left of the guest's rows: designs the account had opened too.
  const both = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM design_opens g
      WHERE g.owner_id = ?2
        AND EXISTS (SELECT 1 FROM design_opens a WHERE a.owner_id = ?1 AND a.design_id = g.design_id)`,
  )
    .bind(toOwnerId, fromOwnerId)
    .first<{ n: number }>();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE design_opens AS a
          SET last_opened_at = g.last_opened_at, last_open_day = g.last_open_day
         FROM design_opens AS g
        WHERE a.owner_id = ?1 AND g.owner_id = ?2 AND g.design_id = a.design_id
          AND g.last_opened_at > a.last_opened_at`,
    ).bind(toOwnerId, fromOwnerId),
    env.DB.prepare('DELETE FROM design_opens WHERE owner_id = ?1').bind(fromOwnerId),
  ]);
  return { moved: moved.meta?.changes ?? 0, merged: both?.n ?? 0 };
}

// Daily retention sweep: an open older than the Timeline's year is forgotten. Signature matches
// the other sweeps so it slots into `scheduleSweep`.
export async function deleteOldDesignOpens(env: Env, cutoff: number): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM design_opens WHERE last_opened_at < ?1')
    .bind(cutoff)
    .run();
  return res.meta?.changes ?? 0;
}
