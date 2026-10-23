// Removing a canvas for good removes everything its Durable Object stored (docs/specs/015-api/api.md "Purging a
// room"): the content (tabs, image references, changesets) and the collaboration ledger. The removal before it is
// the delete, so a room that can't be reached is logged rather than failing the request or the cron; the next purge
// of the same id (the index's internal DELETE) finishes it. The batching and timeout are the shared kit's purgeEach.
import { purgeEach } from '@liveworkspace/index-app';
import { documentRoom } from './document-client';
import type { Env } from './types';

export { ROOM_PURGE_CONCURRENCY } from '@liveworkspace/index-app';

export async function purgeRooms(
  env: Env,
  documentIds: readonly string[],
): Promise<{ rooms: number; unreached: number }> {
  const { unreached } = await purgeEach(documentIds, (id) => documentRoom(env, id).purge());
  return { rooms: documentIds.length, unreached: unreached.length };
}
