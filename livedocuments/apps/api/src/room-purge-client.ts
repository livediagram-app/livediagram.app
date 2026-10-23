// Removing a document for good removes everything its document's Durable Object stored (docs/specs/015-api/api.md
// "Purging a room"): the content (tabs, image references, changesets) and the collaboration ledger, which holds the
// text of every comment, idea and answer the room sequenced. The D1 removal before it is the delete, so a document
// that can't be reached is logged rather than failing the request or the cron; its content is unreachable from
// then on (no document row names it), and the next purge of the same id (the internal DELETE) finishes it.

import { documentRoom } from './document-client';
import type { Env } from './types';

// The api never waits on one room longer than this.
const ROOM_PURGE_TIMEOUT_MS = 3_000;
// Rooms purged at a time, so the Trash cron's 2,000 a day are a steady trickle rather than one burst.
export const ROOM_PURGE_CONCURRENCY = 10;

export async function purgeRooms(
  env: Env,
  documentIds: readonly string[],
): Promise<{ rooms: number; unreached: number }> {
  let unreached = 0;
  for (let i = 0; i < documentIds.length; i += ROOM_PURGE_CONCURRENCY) {
    const batch = documentIds.slice(i, i + ROOM_PURGE_CONCURRENCY);
    const reached = await Promise.all(
      batch.map(async (id) => {
        try {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('purge timeout')), ROOM_PURGE_TIMEOUT_MS);
          });
          try {
            await Promise.race([documentRoom(env, id).purge(), timeout]);
          } finally {
            clearTimeout(timer);
          }
          return true;
        } catch (err) {
          console.warn('[room-purge] did not reach the room', {
            documentId: id,
            error: String(err),
          });
          return false;
        }
      }),
    );
    unreached += reached.filter((ok) => !ok).length;
  }
  if (documentIds.length > 0) {
    console.info('[room-purge] purged', { rooms: documentIds.length, unreached });
  }
  return { rooms: documentIds.length, unreached };
}
