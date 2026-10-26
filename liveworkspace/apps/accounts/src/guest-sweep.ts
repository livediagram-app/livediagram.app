// Guests who can never come back (liveworkspace/docs/specs/003-accounts/accounts.md "Guests who never come back"). A
// guest id lives in liveworkspace.app's `lw_guest` cookie and in each app's guest token. Every hand-off
// stamps when the id was last seen (at most once a day). A guest still using an app is handed a fresh
// token before its year is up, so it is never more than a year unseen. Once an id has gone 400 days
// unseen, its token has lapsed and browsers have dropped its cookie (Chrome caps a cookie at 400
// days), so no app can be handed it again: its settings and profile are deleted. Its items stay in the
// index, as every guest's do, until someone deletes them.
import { GUEST_ID } from './ids.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
// Longer than the guest token's year and the longest a browser keeps the cookie without a visit.
export const GUEST_IDLE_MS = 400 * DAY_MS;
// Guest ids swept per daily run, the longest unseen first: one read and one batch of three deletes.
export const GUEST_SWEEP_LIMIT = 500;

// One upsert, and none at all when the id was already stamped in the last day, so a busy guest costs a
// write a day at most.
export async function noteGuestSeen(db: D1Database, guestId: string, now = Date.now()) {
  if (!GUEST_ID.test(guestId)) return;
  await db
    .prepare(
      `INSERT INTO guest_seen (guest_id, seen_at) VALUES (?1, ?2)
       ON CONFLICT (guest_id) DO UPDATE SET seen_at = excluded.seen_at
       WHERE guest_seen.seen_at < excluded.seen_at - ?3`,
    )
    .bind(guestId, now, DAY_MS)
    .run();
}

// Deletes what is kept against guest ids unseen for GUEST_IDLE_MS, up to GUEST_SWEEP_LIMIT of them.
export async function sweepIdleGuests(db: D1Database, now = Date.now()): Promise<number> {
  const { results } = await db
    .prepare('SELECT guest_id FROM guest_seen WHERE seen_at < ? ORDER BY seen_at LIMIT ?')
    .bind(now - GUEST_IDLE_MS, GUEST_SWEEP_LIMIT)
    .all<{ guest_id: string }>();
  if (results.length === 0) return 0;
  const ids = JSON.stringify(results.map((row) => row.guest_id));
  const cutoff = now - GUEST_IDLE_MS;
  // Checked again in each delete, so a guest seen between the read and the batch keeps everything.
  const idle = `IN (SELECT guest_id FROM guest_seen WHERE guest_id IN (SELECT value FROM json_each(?)) AND seen_at < ?)`;
  await db.batch([
    db.prepare(`DELETE FROM settings WHERE owner_id ${idle}`).bind(ids, cutoff),
    db.prepare(`DELETE FROM profile WHERE owner_id ${idle}`).bind(ids, cutoff),
    db.prepare(`DELETE FROM guest_seen WHERE guest_id ${idle}`).bind(ids, cutoff),
  ]);
  return results.length;
}
