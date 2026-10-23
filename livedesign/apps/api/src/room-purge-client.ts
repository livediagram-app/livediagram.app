// Removing a design for good removes what its realtime room kept too (docs/specs/015-api/api.md "Purging a
// room"): the collaboration ledger holds the text of every comment, idea and answer the room sequenced, which
// outlived the design in DO storage before this. Best-effort, like the other room calls: the D1 removal before
// it is the delete, so a room that can't be reached is logged rather than failing the request or the cron.

import { roomFetch } from './room-client';
import type { Env } from './types';

// The api never waits on one room longer than this.
const ROOM_PURGE_TIMEOUT_MS = 3_000;
// Rooms purged at a time, so the Trash cron's 2,000 a day are a steady trickle rather than one burst.
export const ROOM_PURGE_CONCURRENCY = 10;

export async function purgeRooms(
  env: Env,
  designIds: readonly string[],
): Promise<{ rooms: number; unreached: number }> {
  let unreached = 0;
  for (let i = 0; i < designIds.length; i += ROOM_PURGE_CONCURRENCY) {
    const batch = designIds.slice(i, i + ROOM_PURGE_CONCURRENCY);
    const reached = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await roomFetch(env, id, '/purge', { method: 'POST' }, ROOM_PURGE_TIMEOUT_MS);
          if (!res.ok) throw new Error(`status ${res.status}`);
          return true;
        } catch (err) {
          console.warn('[room-purge] did not reach the room', {
            designId: id,
            error: String(err),
          });
          return false;
        }
      }),
    );
    unreached += reached.filter((ok) => !ok).length;
  }
  if (designIds.length > 0) {
    console.info('[room-purge] purged', { rooms: designIds.length, unreached });
  }
  return { rooms: designIds.length, unreached };
}
