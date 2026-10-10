// Offline Mode conversions (docs/specs/006-document/offline-mode.md): move a document between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the document: the destination is
// written before the source is removed. Taking a cloud document offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { storeAsCreates } from '@livediagram/items';
import { fetchItems } from '../api/items';
import {
  apiCreateDocument,
  apiListFavourites,
  apiLoadDocument,
  apiLoadTab,
  apiSetFavourite,
} from '@/lib/api-client';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { embedTabImages, isDataImageId, uploadEmbeddedImages } from './offline-images';
import {
  offlineCreateDocument,
  offlineDeleteDocument,
  offlineGetRecord,
  offlinePutRecord,
  type OfflineDocumentRecord,
} from './offline-store';
import { fetchAllSheets, sheetAsCreate } from '../api/sheets';

// Offline → Cloud ("Save to your account"). Creates the cloud copy first, then
// removes the local one, so a network failure leaves the offline document
// intact. Returns the (unchanged) document id. `apiCreateDocument` does not
// dispatch on the offline index, so it always writes to the server even while
// the id is still registered offline.
export async function saveOfflineToCloud(offlineId: string, ownerId: string): Promise<string> {
  const rec = await offlineGetRecord(offlineId);
  if (!rec) throw new Error('offline document not found');
  // Re-home embedded data-URI images to R2 first (docs/specs/009-elements/images.md + /76): the cloud
  // copy gets real gallery images instead of bloated tab JSON. Best-effort
  // per image; a kept data URI still renders.
  const tabs = await uploadEmbeddedImages(ownerId, rec.tabs);
  // Declare the conversion so the feed says "Synced to the Cloud" rather than
  // reporting a brand-new document (docs/specs/006-document/offline-mode.md + docs/specs/013-workspace/timeline.md).
  // Everything the record holds besides tabs travels too: the local copy is
  // deleted next, so a deck or placement left behind is gone for good.
  const upload = (folderId: string | null) =>
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
    await upload(rec.folderId ?? null);
  } catch (err) {
    // The server refuses a folder deleted since, or not the caller's, by name and writes nothing
    // (docs/specs/013-workspace/folders.md "Placement on create"). The sync files the document in
    // the root of My documents instead, on its own say-so, rather than losing the conversion over a folder.
    const code = err instanceof ApiError ? err.code : null;
    if (code !== 'folder_not_found' && code !== 'folder_scope_mismatch') throw err;
    console.warn(`[offline-sync] placement refused reason=${code}, filed at root`);
    await upload(null);
  }
  await offlineDeleteDocument(rec.id);
  // The star lived on the offline record (docs/specs/013-workspace/favourites.md), which just went. Re-star
  // on the server AFTER the delete: while the id is still registered offline,
  // apiSetFavourite would route the star straight back to the local store.
  if (rec.favourite) await apiSetFavourite(ownerId, rec.id, true);
  return rec.id;
}

// Cloud → Offline ("Take offline"). Downloads the whole document, writes it to
// IndexedDB, then DELETES the server record (and thus any share links). The
// local write happens first so a failed delete leaves a (harmless) duplicate
// rather than nothing. The server delete goes through the raw `apiDelete` so it
// isn't re-routed to the local store once the id is registered offline.
export async function takeCloudOffline(
  documentId: string,
  ownerId: string,
  shareCode: string | null = null,
): Promise<void> {
  const liveDoc = await apiLoadDocument(ownerId, documentId);
  if (!liveDoc) throw new Error('document not found');
  const fetchedTabs = (
    await Promise.all(
      liveDoc.tabs.map((s) => apiLoadTab(ownerId, documentId, s.id, shareCode).catch(() => null)),
    )
  ).filter((t): t is NonNullable<typeof t> => t !== null);
  // EVERY tab, or nothing. A tab can come back null from two directions — a
  // thrown request caught above, or a 404 that `expectOkOrNull` turns into a
  // null without throwing — and either way filtering the gap away and carrying
  // on would write an offline record missing that tab, then DELETE the server
  // copy below. That is the one failure in this file that isn't recoverable:
  // the tab's elements would exist nowhere, and the user would be told the
  // conversion worked.
  //
  // The best-effort filter is borrowed from duplicate-document.ts, where it's
  // correct because duplication leaves the source intact. Here the source is
  // destroyed, which inverts the trade. Abort exactly as the image-embed guard
  // below does, and for a stronger reason: that one protects bytes a reaper
  // might collect in 30 days, this one protects content that would be gone
  // immediately.
  if (fetchedTabs.length !== liveDoc.tabs.length) throw new Error('tab load incomplete');
  // The item store too, all or nothing, for the same reason: the server copy is deleted below
  // (docs/specs/026-plan/items.md "Offline documents"). A failed fetch throws and aborts.
  const itemStore = await fetchItems({ ownerId, documentId, shareCode, tabId: null });
  // And the sheet store, all or nothing (docs/specs/029-sheets/sheet-store.md "Offline documents").
  const sheets = await fetchAllSheets({ ownerId, documentId, shareCode, tabId: null });
  // Embed referenced R2 images as data URIs BEFORE the server delete below:
  // once the document row is gone, its images count as unused and the api's
  // 30-day retention reaper would delete the bytes the offline document still
  // points at (docs/specs/009-elements/images.md + /76).
  const tabs = await embedTabImages(fetchedTabs, { ownerId, documentId, shareCode });
  // Embedding is best-effort per image, but the DELETE below is not: if any
  // image failed to embed, aborting here keeps the server copy (and its
  // images) alive instead of quietly signing the stragglers up for the
  // 30-day reaper. The caller surfaces the failure; the user can retry.
  const unembedded = tabs.some((t) =>
    t.elements.some((el) => el.type === 'image' && el.imageId && !isDataImageId(el.imageId)),
  );
  if (unembedded) throw new Error('image embed incomplete');

  // The cloud star is a row keyed on the document, so the server delete below
  // takes it too; carry it onto the offline record (docs/specs/013-workspace/favourites.md). Best-effort:
  // apiListFavourites answers [] rather than throwing when the fetch fails.
  const starred = (await apiListFavourites(ownerId)).includes(liveDoc.id);
  const now = Date.now();
  const rec: OfflineDocumentRecord = {
    id: liveDoc.id,
    name: liveDoc.name,
    // Keep its place and its deck: the server row, the only other copy, is
    // deleted below. A team folder isn't a place in the personal tree the
    // offline record lives in, so a team document lands at the root of My documents.
    folderId: liveDoc.teamId ? null : (liveDoc.folderId ?? null),
    createdAt: liveDoc.createdAt ?? now,
    savedAt: now,
    tabs,
    ...(liveDoc.presentation ? { presentation: liveDoc.presentation } : {}),
    ...(starred ? { favourite: true } : {}),
    ...(liveDoc.itemTypes ? { itemTypes: liveDoc.itemTypes } : {}),
    ...(itemStore.items.length
      ? { items: itemStore.items, itemsRev: itemStore.rev, itemsNextKey: itemStore.nextKey }
      : {}),
    ...(sheets.length ? { sheets } : {}),
  };
  await offlinePutRecord(rec);
  // Raw server delete — the id is now in the offline index, so the dispatching
  // apiDeleteDocument would target the local store instead of the server.
  try {
    // Declare the conversion: this DELETE is indistinguishable from a real
    // delete at the boundary, and undeclared the feed told the owner their
    // document had been deleted (docs/specs/006-document/offline-mode.md + docs/specs/013-workspace/timeline.md).
    await apiDelete(`${API_BASE}/documents/${documentId}`, ownerId, {
      action: 'take offline',
      extra: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });
  } catch (e) {
    // The server copy survived, so ROLL BACK the local copy: leaving both
    // registered under one id would shadow the live cloud document behind a
    // stale offline fork (and duplicate the Explorer row). Data-safe: the
    // server still holds everything.
    await offlineDeleteDocument(rec.id).catch(() => {});
    throw e;
  }
}

// Toast copy for a failed Sync Document, shared by the Explorer menus (via
// useOfflineConversion) and the Share dialog's offline gate. A 413 is the
// hard per-tab size cap (usually a large embedded image whose gallery
// upload failed, leaving the data URI in the tab JSON): retrying won't
// help, so it must not read as a connection problem.
export function syncFailureMessage(e: unknown): string {
  return e instanceof ApiError && e.status === 413
    ? 'This document is too large to sync: a tab exceeds the server size limit, usually a big embedded image. Remove or shrink it and try again.'
    : 'Could not sync this document. Check your connection and try again.';
}

// Re-exported for callers that only need to create an offline document from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateDocument };
