// A purged room stays purged (docs/specs/015-api/api.md "Internal endpoints", "A purged room stays purged"): the
// purge keeps one key, its time, so a grant the index signed before it (an editor holds one for ten minutes) can't
// start the plan afresh, empty, under the deleted id. Only a room with no plan schema ever reads the key, so a plan
// with content pays nothing on its open path.

// The purge's time (epoch ms), the one key a purged room keeps.
export const PURGED_KEY = 'purged';

// What the mark needs of the room (plan-room.ts).
export type PurgedRoom = {
  state: { storage: Pick<DurableObjectStorage, 'get' | 'put' | 'delete'> };
  storedSchema(): boolean;
  // The purge's time, null when the room is not purged, undefined until read.
  purgedAt: number | null | undefined;
};

// The purge has just dropped everything: keep its time.
export async function markPurged(room: PurgedRoom, now: number): Promise<void> {
  room.purgedAt = now;
  await room.state.storage.put(PURGED_KEY, now);
}

// The purge's time when the room was purged and nothing has started it since; null otherwise. A room holding a plan
// schema answers null without a read, and the answer is kept for the object's life (a purge sets it again).
export async function purgedAt(room: PurgedRoom): Promise<number | null> {
  if (room.purgedAt !== undefined) return room.purgedAt;
  if (room.storedSchema()) {
    room.purgedAt = null;
    return null;
  }
  const at = await room.state.storage.get<number>(PURGED_KEY);
  room.purgedAt = typeof at === 'number' ? at : null;
  return room.purgedAt;
}

// Whether a grant signed at `iat` (epoch seconds, the index's claim) predates a purge at `at` (epoch ms). A grant
// from the purge's own second counts as after it, so Sync Project's delete-then-create is never refused; a grant
// with no `iat` (the index always signs one) is treated as before.
export function signedBeforePurge(iat: number | undefined, at: number): boolean {
  return typeof iat !== 'number' || iat < Math.floor(at / 1000);
}

// Whether a request holding `grant` (null: none on this plan) may reach a room. A purged room admits only a grant
// the index signed from the purge on, which means the index holds the item again; that lifts the mark.
export async function admitAfterPurge(
  room: PurgedRoom,
  grant: { iat?: number } | null,
): Promise<boolean> {
  const at = await purgedAt(room);
  if (at === null) return true;
  if (!grant || signedBeforePurge(grant.iat, at)) {
    console.info('[room] refused on a purged plan');
    return false;
  }
  room.purgedAt = null;
  await room.state.storage.delete(PURGED_KEY);
  console.info('[room] purged plan started again');
  return true;
}
