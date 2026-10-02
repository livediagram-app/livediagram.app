// The local Trash (docs/specs/013-workspace/trash.md, "The local Trash"): an
// Offline Mode document lives only in this browser, so its Trash does too.
// Deleting one stamps `trashedAt` on its IndexedDB record; the record keeps
// everything else. The 30-day rule is the api's, applied whenever the app
// lists documents instead of by a cron.

import { isTrashExpired, trashPurgeDueAt, type TrashedDocument } from '@livediagram/api-schema';
import {
  offlineBackend,
  offlineDeleteDocument,
  serializeOfflineWrite,
  type OfflineDocumentRecord,
} from './offline-store';
import { debugLog } from '@/lib/debug-log';

function trashRow(rec: OfflineDocumentRecord & { trashedAt: number }): TrashedDocument {
  return {
    id: rec.id,
    name: rec.name,
    teamId: null,
    teamName: null,
    trashedAt: rec.trashedAt,
    purgeAt: trashPurgeDueAt(rec.trashedAt),
  };
}

function isTrashed(
  rec: OfflineDocumentRecord | undefined,
): rec is OfflineDocumentRecord & { trashedAt: number } {
  return rec?.trashedAt !== undefined;
}

// Move a live record to the local Trash. The first deletion time stands.
export async function offlineTrashDocument(id: string, now: number): Promise<void> {
  await serializeOfflineWrite(async () => {
    const rec = await offlineBackend().get(id);
    if (!rec || isTrashed(rec)) return;
    await offlineBackend().put({ ...rec, trashedAt: now });
  });
}

// Bring a trashed record back exactly as it was: folder, star, deck. False
// when it isn't in the local Trash.
export async function offlineRestoreDocument(id: string): Promise<boolean> {
  return serializeOfflineWrite(async () => {
    const rec = await offlineBackend().get(id);
    if (!isTrashed(rec)) return false;
    const { trashedAt: _trashedAt, ...live } = rec;
    await offlineBackend().put(live);
    return true;
  });
}

// Delete a trashed record for good. Never a live one: the local Trash can't
// be skipped by naming an id.
export async function offlinePurgeDocument(id: string): Promise<boolean> {
  if (!isTrashed(await offlineBackend().get(id))) return false;
  await offlineDeleteDocument(id);
  return true;
}

// Newest first, as rows of the same shape the api's Trash returns.
export async function offlineListTrash(): Promise<TrashedDocument[]> {
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
  for (const rec of expired) await offlineDeleteDocument(rec.id);
  if (expired.length > 0) debugLog('[trash] purged local', expired.length);
  return expired.length;
}
