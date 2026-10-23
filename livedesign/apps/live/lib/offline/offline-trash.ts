// The local Trash (docs/specs/013-workspace/trash.md, "The local Trash"): an
// Offline Mode design lives only in this browser, so its Trash does too.
// Deleting one stamps `trashedAt` on its IndexedDB record; the record keeps
// everything else. The 30-day rule is the api's, applied whenever the app
// lists designs instead of by a cron.

import { isTrashExpired, trashPurgeDueAt, type TrashedDesign } from '@livedesign/api-schema';
import {
  offlineBackend,
  offlineDeleteDesign,
  offlineUpdateRecord,
  serializeOfflineWrite,
  type OfflineDesignRecord,
} from './offline-store';
import { debugLog } from '@/lib/debug-log';

function trashRow(rec: OfflineDesignRecord & { trashedAt: number }): TrashedDesign {
  return {
    id: rec.id,
    name: rec.name,
    teamId: null,
    teamName: null,
    trashedAt: rec.trashedAt,
    purgeAt: trashPurgeDueAt(rec.trashedAt),
    // Only the server's clean-up moves empty designs; a local row was deleted.
    reason: 'deleted',
  };
}

function isTrashed(
  rec: OfflineDesignRecord | undefined,
): rec is OfflineDesignRecord & { trashedAt: number } {
  return rec?.trashedAt !== undefined;
}

// Move a live record to the local Trash. The first deletion time stands.
export async function offlineTrashDesign(id: string, now: number): Promise<void> {
  await serializeOfflineWrite(() =>
    offlineUpdateRecord(id, (rec) =>
      !rec || isTrashed(rec) ? undefined : { ...rec, trashedAt: now },
    ),
  );
}

// Bring a trashed record back exactly as it was: folder, star, deck. False
// when it isn't in the local Trash.
export async function offlineRestoreDesign(id: string): Promise<boolean> {
  return serializeOfflineWrite(async () => {
    let restored = false;
    await offlineUpdateRecord(id, (rec) => {
      if (!isTrashed(rec)) return undefined;
      const { trashedAt: _trashedAt, ...live } = rec;
      restored = true;
      return live;
    });
    return restored;
  });
}

// Delete a trashed record for good. Never a live one: the local Trash can't
// be skipped by naming an id.
export async function offlinePurgeDesign(id: string): Promise<boolean> {
  if (!isTrashed(await offlineBackend().get(id))) return false;
  await offlineDeleteDesign(id);
  return true;
}

// Newest first, as rows of the same shape the api's Trash returns.
export async function offlineListTrash(): Promise<TrashedDesign[]> {
  const recs = await offlineBackend().all();
  return recs
    .filter(isTrashed)
    .map(trashRow)
    .sort((a, b) => b.trashedAt - a.trashedAt);
}

// Purge every record 30 days in the local Trash. Returns how many went.
export async function offlinePurgeExpiredTrash(now: number): Promise<number> {
  const expired = (await offlineBackend().all()).filter(
    (r) => isTrashed(r) && isTrashExpired(r.trashedAt, now),
  );
  for (const rec of expired) await offlineDeleteDesign(rec.id);
  if (expired.length > 0) debugLog('[trash] purged local', expired.length);
  return expired.length;
}
