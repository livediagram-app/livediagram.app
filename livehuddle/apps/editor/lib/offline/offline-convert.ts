// Offline Mode conversions (docs/specs/006-document/offline-mode.md): move a document between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the document: the destination is
// written before the source is removed. Taking a cloud document offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { apiLoadDocument, apiLoadTab } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { DOCUMENT_CONVERSION_HEADER } from '@livehuddle/api-schema';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { embedTabImages, isDataImageId, tabImageIds } from './offline-images';
import {
  offlineCreateDocument,
  offlineDeleteDocument,
  offlinePutRecord,
  type OfflineDocumentRecord,
} from './offline-store';
import {
  OfflineSyncIncompleteError,
  syncOfflineDocument,
  type OfflineSyncResult,
} from './offline-sync';

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

// Offline → Cloud ("Sync Canvas"), in ./offline-sync. Returns the (unchanged) document id and the images it
// re-homed (data URI -> gallery id), for an editor syncing in place.
export function saveOfflineToCloud(offlineId: string, ownerId: string): Promise<OfflineSyncResult> {
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
  // Embed referenced R2 images as data URIs BEFORE the server delete below:
  // once the document row is gone, its images count as unused and the api's
  // 30-day retention reaper would delete the bytes the offline document still
  // points at (docs/specs/009-elements/images.md + /76).
  const tabs = await embedTabImages(fetchedTabs, { ownerId, documentId, shareCode });
  // Embedding is best-effort per image, but the DELETE below is not: if any
  // image failed to embed, aborting here keeps the server copy (and its
  // images) alive instead of quietly signing the stragglers up for the
  // 30-day reaper. The caller surfaces the failure; the user can retry.
  const unembedded = tabs.some((t) => tabImageIds(t).some((id) => !isDataImageId(id)));
  if (unembedded) throw new Error('image embed incomplete');

  // The person's star is the index's, on the canvas's item, which the server delete below takes too; carry it onto
  // the offline record (docs/specs/013-workspace/favourites.md). A failed read aborts here, before anything is
  // written: taken as "not starred" it would drop the star.
  const { item } = await indexClient.getItem(liveDoc.id);
  const starred = item.favourite;
  const now = Date.now();
  const rec: OfflineDocumentRecord = {
    id: liveDoc.id,
    name: liveDoc.name,
    // Keep its place and its deck: the server row, the only other copy, is
    // deleted below. A team folder isn't a place in the personal tree the
    // offline record lives in, so a team document lands at the root of My Work.
    folderId: liveDoc.teamId ? null : (liveDoc.folderId ?? null),
    createdAt: liveDoc.createdAt ?? now,
    savedAt: now,
    tabs,
    ...(liveDoc.presentation ? { presentation: liveDoc.presentation } : {}),
    ...(starred ? { favourite: true } : {}),
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

// Toast copy for a failed Sync Canvas, shared by the Explorer menus (via
// useOfflineConversion) and the Share dialog's offline gate. A 413 is the
// hard per-tab size cap (usually a large embedded image whose gallery
// upload failed, leaving the data URI in the tab JSON): retrying won't
// help, so it must not read as a connection problem.
// A sync from inside the editor that found this browser's last save still going after
// SYNC_SAVE_WAIT_MS (app/document/[id]/useSyncInPlace.ts): refused rather than racing it.
export class SyncStillSavingError extends Error {
  constructor() {
    super('Still saving this canvas. Try again in a moment.');
    this.name = 'SyncStillSavingError';
  }
}

// A sync stopped by its own checks (./offline-sync) names what happened: the local copy is kept
// either way, and a retry is the fix.
export function syncFailureMessage(e: unknown): string {
  if (e instanceof SyncStillSavingError) return e.message;
  if (e instanceof OfflineSyncIncompleteError)
    return 'This canvas kept changing while syncing. Your copy is safe: try again soon.';
  return e instanceof ApiError && e.status === 413
    ? 'Too large to sync, usually a big image on a tab. Shrink it and try again.'
    : 'Could not sync this canvas. Check your connection and try again.';
}

// Re-exported for callers that only need to create an offline document from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateDocument };
