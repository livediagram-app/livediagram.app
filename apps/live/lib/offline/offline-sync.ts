// Offline → Cloud ("Sync Document", docs/specs/006-document/offline-mode.md "Save to server").
// Creates the cloud copy first, then removes the local one, so a network failure leaves the
// offline document intact. `apiCreateDocument` does not dispatch on the offline index, so it
// always writes to the server even while the id is still registered offline.
//
// The upload takes seconds, and the document stays editable (and writable from another tab)
// while it runs. So the local copy is removed only if it still matches what went up, checked and
// deleted in one transaction; a change in between takes the cloud copy back and uploads again.
// And the cloud copy must hold every card and sheet before the local one goes: a create that
// resolves to an existing row (a retry after a half-finished sync) never re-seeds those stores.

import { storeAsCreates } from '@livediagram/items';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { apiCreateDocument, apiSetFavourite } from '@/lib/api-client';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { fetchCloudItems } from '../api/items';
import { fetchCloudSheets, sheetAsCreate } from '../api/sheets';
import { uploadEmbeddedImages } from './offline-images';
import {
  offlineDeleteIfUnchanged,
  offlineGetRecord,
  type OfflineDocumentRecord,
} from './offline-store';

// How many times a sync uploads a document that keeps changing under it before giving up. Each
// change during the upload costs one more upload; three covers a person still typing for a few
// seconds after choosing Sync Document, without retrying forever against a busy other tab.
export const SYNC_UPLOAD_ATTEMPTS = 3;

// Why a sync stopped with the local copy kept: it changed during every upload, or the cloud copy
// came up short of its cards or sheets.
export class OfflineSyncIncompleteError extends Error {
  readonly reason: 'kept_changing' | 'stores_short';
  constructor(reason: 'kept_changing' | 'stores_short') {
    super(`offline sync incomplete: ${reason}`);
    this.reason = reason;
    this.name = 'OfflineSyncIncompleteError';
  }
}

// What the upload carried, as far as a later write would change it: every edit stamps savedAt
// (tabs, name, deck, folder, card types), a card write moves itemsRev, a sheet write its rev.
// A star or an open changes neither, and needs no new upload.
export function uploadMark(rec: OfflineDocumentRecord): string {
  return JSON.stringify([
    rec.savedAt,
    rec.itemsRev ?? 0,
    (rec.sheets ?? []).map((s) => [s.id, s.rev, s.updatedAt]),
  ]);
}

async function upload(rec: OfflineDocumentRecord, ownerId: string): Promise<void> {
  // Re-home embedded data-URI images to R2 first (docs/specs/009-elements/images.md + /76): the cloud
  // copy gets real gallery images instead of bloated tab JSON. Best-effort
  // per image; a kept data URI still renders.
  const tabs = await uploadEmbeddedImages(ownerId, rec.tabs);
  // Declare the conversion so the feed says "Synced to the Cloud" rather than
  // reporting a brand-new document (docs/specs/006-document/offline-mode.md + docs/specs/013-workspace/timeline.md).
  // Everything the record holds besides tabs travels too: the local copy is
  // deleted next, so a deck or placement left behind is gone for good.
  const create = (folderId: string | null) =>
    apiCreateDocument(
      ownerId,
      {
        id: rec.id,
        name: rec.name,
        tabs,
        folderId,
        createdAt: rec.createdAt,
        presentation: rec.presentation ?? null,
        // The item store, in each column's order (docs/specs/026-plan/items.md "Offline documents").
        items: storeAsCreates(rec.items ?? []),
        // And its type catalogue (docs/specs/026-plan/item-types.md "Storage and sync").
        itemTypes: rec.itemTypes ?? null,
        // The sheet store, whole (docs/specs/029-sheets/sheet-store.md "Offline documents").
        ...(rec.sheets?.length ? { sheets: rec.sheets.map(sheetAsCreate) } : {}),
      },
      { conversion: 'sync' },
    );
  try {
    await create(rec.folderId ?? null);
  } catch (err) {
    // The server refuses a folder deleted since, or not the caller's, by name and writes nothing
    // (docs/specs/013-workspace/folders.md "Placement on create"). The sync files the document in
    // the root of My documents instead, on its own say-so, rather than losing the conversion over a folder.
    const code = err instanceof ApiError ? err.code : null;
    if (code !== 'folder_not_found' && code !== 'folder_scope_mismatch') throw err;
    console.warn(`[offline-sync] placement refused reason=${code}, filed at root`);
    await create(null);
  }
}

// True when the cloud copy holds as many cards and sheets as the record. Skips the fetch for a
// record with none (the common case: a diagram-only document).
async function cloudHoldsStores(rec: OfflineDocumentRecord, ownerId: string): Promise<boolean> {
  const scope = { ownerId, documentId: rec.id, shareCode: null, tabId: null };
  const items = rec.items?.length ?? 0;
  const sheets = rec.sheets?.length ?? 0;
  if (items > 0 && (await fetchCloudItems(scope)).items.length !== items) return false;
  if (sheets > 0 && (await fetchCloudSheets(scope)).length !== sheets) return false;
  return true;
}

// Take back a cloud copy the local one was not swapped for, so a retry is a genuine create again.
// Declared as a move into this browser, which is what it is, so it bypasses the Trash and the feed
// does not report a deletion. Best-effort: a copy left behind is caught by the store check next time.
async function takeBackCloudCopy(id: string, ownerId: string): Promise<void> {
  try {
    await apiDelete(`${API_BASE}/documents/${id}`, ownerId, {
      action: 'sync take back',
      extra: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });
  } catch (err) {
    console.warn('[offline-sync] take-back failed', err);
  }
}

// Returns the (unchanged) document id. Callers go through ./offline-convert's saveOfflineToCloud,
// which refuses a second conversion of the same document while one runs.
export async function syncOfflineDocument(offlineId: string, ownerId: string): Promise<string> {
  let rec = await offlineGetRecord(offlineId);
  if (!rec) throw new Error('offline document not found');
  for (let attempt = 1; ; attempt++) {
    await upload(rec, ownerId);
    if (!(await cloudHoldsStores(rec, ownerId))) {
      console.warn('[offline-sync] stores-short, local copy kept');
      await takeBackCloudCopy(rec.id, ownerId);
      throw new OfflineSyncIncompleteError('stores_short');
    }
    const uploaded = uploadMark(rec);
    const done = await offlineDeleteIfUnchanged(rec.id, (now) => uploadMark(now) === uploaded);
    // Gone already: another tab finished a sync of it first. Nothing here is left to move.
    if (done.outcome === 'missing') return rec.id;
    if (done.outcome === 'deleted') {
      // The star lived on the offline record (docs/specs/013-workspace/favourites.md), which just went. Re-star
      // on the server AFTER the delete: while the id is still registered offline,
      // apiSetFavourite would route the star straight back to the local store.
      if (done.rec.favourite) await apiSetFavourite(ownerId, rec.id, true);
      return rec.id;
    }
    console.warn(`[offline-sync] changed-during-upload attempt=${attempt}`);
    await takeBackCloudCopy(rec.id, ownerId);
    if (attempt >= SYNC_UPLOAD_ATTEMPTS) throw new OfflineSyncIncompleteError('kept_changing');
    rec = done.rec;
  }
}
