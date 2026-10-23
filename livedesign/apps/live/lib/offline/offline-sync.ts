// Offline → Cloud ("Sync Design", docs/specs/006-design/offline-mode.md "Save to server").
// Creates the cloud copy first, then removes the local one, so a network failure leaves the
// offline design intact. `apiCreateDesign` does not dispatch on the offline index, so it
// always writes to the server even while the id is still registered offline.
//
// The upload takes seconds, and the design stays editable (and writable from another tab)
// while it runs. So the local copy is removed only if it still matches what went up, checked and
// deleted in one transaction; a change in between takes the cloud copy back and uploads again.

import { DESIGN_CONVERSION_HEADER } from '@livedesign/api-schema';
import { apiCreateDesign } from '@/lib/api-client';
import { indexClient } from '@/lib/index-client';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { uploadEmbeddedImages } from './offline-images';
import {
  offlineDeleteIfUnchanged,
  offlineGetRecord,
  type OfflineDesignRecord,
} from './offline-store';

// How many times a sync uploads a design that keeps changing under it before giving up. Each
// change during the upload costs one more upload; three covers a person still typing for a few
// seconds after choosing Sync Design, without retrying forever against a busy other tab.
const SYNC_UPLOAD_ATTEMPTS = 3;

// Why a sync stopped with the local copy kept: it changed during every upload.
export class OfflineSyncIncompleteError extends Error {
  readonly reason: 'kept_changing';
  constructor(reason: 'kept_changing') {
    super(`offline sync incomplete: ${reason}`);
    this.reason = reason;
    this.name = 'OfflineSyncIncompleteError';
  }
}

// What the upload carried, as far as a later write would change it: every edit stamps savedAt (tabs,
// name, deck, folder). A star or an open does not, and needs no new upload.
function uploadMark(rec: OfflineDesignRecord): string {
  return String(rec.savedAt);
}

// What a finished sync hands back: the (unchanged) design id, and every image it re-homed (data URI ->
// gallery id), so an editor syncing in place can re-point its own copy (docs/specs/006-design/offline-mode.md
// "Syncing in place").
export type OfflineSyncResult = { id: string; imageIds: Map<string, string> };

// Uploads the record and answers the images it re-homed.
async function upload(rec: OfflineDesignRecord, ownerId: string): Promise<Map<string, string>> {
  // Re-home embedded data-URI images to R2 first (docs/specs/009-elements/images.md + /76): the cloud
  // copy gets real gallery images instead of bloated tab JSON. Best-effort
  // per image; a kept data URI still renders.
  const { tabs, imageIds } = await uploadEmbeddedImages(ownerId, rec.tabs);
  // Declare the conversion so the feed says "Synced to the Cloud" rather than
  // reporting a brand-new design (docs/specs/006-design/offline-mode.md + docs/specs/013-workspace/timeline.md).
  // Everything the record holds besides tabs travels too: the local copy is
  // deleted next, so a deck or placement left behind is gone for good.
  const create = (folderId: string | null) =>
    apiCreateDesign(
      ownerId,
      {
        id: rec.id,
        name: rec.name,
        tabs,
        folderId,
        createdAt: rec.createdAt,
        presentation: rec.presentation ?? null,
      },
      { conversion: 'sync' },
    );
  try {
    await create(rec.folderId ?? null);
  } catch (err) {
    // The server refuses a folder deleted since, or not the caller's, by name and writes nothing
    // (docs/specs/013-workspace/folders.md "Placement on create"). The sync files the design in
    // the root of My Work instead, on its own say-so, rather than losing the conversion over a folder.
    const code = err instanceof ApiError ? err.code : null;
    if (code !== 'folder_not_found' && code !== 'folder_scope_mismatch') throw err;
    console.warn(`[offline-sync] placement refused reason=${code}, filed at root`);
    await create(null);
  }
  return imageIds;
}

// Take back a cloud copy the local one was not swapped for, so a retry is a genuine create again.
// Declared as a move into this browser, which is what it is, so it bypasses the Trash and the feed
// does not report a deletion. Best-effort: a copy left behind is caught by the store check next time.
async function takeBackCloudCopy(id: string, ownerId: string): Promise<void> {
  try {
    await apiDelete(`${API_BASE}/designs/${id}`, ownerId, {
      action: 'sync take back',
      extra: { [DESIGN_CONVERSION_HEADER]: 'offline' },
    });
  } catch (err) {
    console.warn('[offline-sync] take-back failed', err);
  }
}

// Callers go through ./offline-convert's saveOfflineToCloud, which refuses a second conversion of the
// same design while one runs. The images re-homed are gathered across attempts: a retry uploads the
// record as it changed, which may hold pictures the first upload never saw.
export async function syncOfflineDesign(
  offlineId: string,
  ownerId: string,
): Promise<OfflineSyncResult> {
  let rec = await offlineGetRecord(offlineId);
  if (!rec) throw new Error('offline design not found');
  const imageIds = new Map<string, string>();
  for (let attempt = 1; ; attempt++) {
    for (const [dataUrl, id] of await upload(rec, ownerId)) imageIds.set(dataUrl, id);
    const uploaded = uploadMark(rec);
    const done = await offlineDeleteIfUnchanged(rec.id, (now) => uploadMark(now) === uploaded);
    // Gone already: another tab finished a sync of it first. Nothing here is left to move.
    if (done.outcome === 'missing') return { id: rec.id, imageIds };
    if (done.outcome === 'deleted') {
      // The star lived on the offline record (docs/specs/013-workspace/favourites.md), which just went: it goes onto
      // the design's index item, which the upload made. A failed star leaves the design synced, unstarred.
      if (done.rec.favourite) await indexClient.favourite(rec.id).catch(() => {});
      return { id: rec.id, imageIds };
    }
    console.warn(`[offline-sync] changed-during-upload attempt=${attempt}`);
    await takeBackCloudCopy(rec.id, ownerId);
    if (attempt >= SYNC_UPLOAD_ATTEMPTS) throw new OfflineSyncIncompleteError('kept_changing');
    rec = done.rec;
  }
}
