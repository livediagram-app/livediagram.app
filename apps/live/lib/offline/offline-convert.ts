// Offline Mode conversions (docs/specs/006-document/offline-mode.md): move a document between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the document: the destination is
// written before the source is removed. Taking a cloud document offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { fetchItems } from '../api/items';
import { apiLoadDocument, apiLoadTab, fetchCloudFavouriteIds } from '@/lib/api-client';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { embedTabImages, isDataImageId } from './offline-images';
import {
  offlineCreateDocument,
  offlineDeleteDocument,
  offlinePutRecord,
  type OfflineDocumentRecord,
} from './offline-store';
import { fetchAllSheets } from '../api/sheets';
import { OfflineSyncIncompleteError, syncOfflineDocument } from './offline-sync';

// One conversion per document at a time, in this tab: two overlapping ones (a second menu, or the
// Share gate beside a menu) would each upload, or each delete, behind the other's back. Kept here
// rather than in the menu that starts it, which unmounts when it closes and forgets.
const converting = new Set<string>();

// Thrown by a conversion started while another of the same document runs. Callers stay quiet: the
// first one reports for both.
export class ConversionInProgressError extends Error {
  constructor() {
    super('offline conversion already running');
    this.name = 'ConversionInProgressError';
  }
}

export function conversionInProgress(documentId: string): boolean {
  return converting.has(documentId);
}

async function oneAtATime<T>(documentId: string, run: () => Promise<T>): Promise<T> {
  if (converting.has(documentId)) throw new ConversionInProgressError();
  converting.add(documentId);
  try {
    return await run();
  } finally {
    converting.delete(documentId);
  }
}

// Offline → Cloud ("Sync Document"), in ./offline-sync.
export function saveOfflineToCloud(offlineId: string, ownerId: string): Promise<string> {
  return oneAtATime(offlineId, () => syncOfflineDocument(offlineId, ownerId));
}

// Cloud → Offline ("Take offline"). Downloads the whole document, writes it to
// IndexedDB, then DELETES the server record (and thus any share links). The
// local write happens first so a failed delete leaves a (harmless) duplicate
// rather than nothing. The server delete goes through the raw `apiDelete` so it
// isn't re-routed to the local store once the id is registered offline.
export function takeCloudOffline(
  documentId: string,
  ownerId: string,
  shareCode: string | null = null,
): Promise<void> {
  return oneAtATime(documentId, () => downloadAndRemoveCloudCopy(documentId, ownerId, shareCode));
}

async function downloadAndRemoveCloudCopy(
  documentId: string,
  ownerId: string,
  shareCode: string | null,
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
  // takes it too; carry it onto the offline record (docs/specs/013-workspace/favourites.md). A failed
  // read aborts here, before anything is written: taken as "not starred" it would drop the star.
  const starred = (await fetchCloudFavouriteIds(ownerId)).includes(liveDoc.id);
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
// A sync stopped by its own checks (./offline-sync) names what happened: the local copy is kept
// either way, and a retry is the fix.
export function syncFailureMessage(e: unknown): string {
  if (e instanceof OfflineSyncIncompleteError)
    return e.reason === 'kept_changing'
      ? 'This document kept changing while it synced. Your local copy is safe; try again when you finish editing.'
      : 'The cloud copy came up short of cards or sheets, so your local copy was kept. Try again.';
  return e instanceof ApiError && e.status === 413
    ? 'This document is too large to sync: a tab exceeds the server size limit, usually a big embedded image. Remove or shrink it and try again.'
    : 'Could not sync this document. Check your connection and try again.';
}

// Re-exported for callers that only need to create an offline document from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateDocument };
