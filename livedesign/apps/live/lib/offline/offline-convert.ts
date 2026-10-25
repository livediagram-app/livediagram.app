// Offline Mode conversions (docs/specs/006-design/offline-mode.md): move a design between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the design: the destination is
// written before the source is removed. Taking a cloud design offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { apiLoadDesign, apiLoadTab } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { DESIGN_CONVERSION_HEADER } from '@livedesign/api-schema';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { embedTabImages, isDataImageId, tabImageIds } from './offline-images';
import {
  offlineCreateDesign,
  offlineDeleteDesign,
  offlinePutRecord,
  type OfflineDesignRecord,
} from './offline-store';
import {
  OfflineSyncIncompleteError,
  syncOfflineDesign,
  type OfflineSyncResult,
} from './offline-sync';

// One conversion per design at a time, in this tab: two overlapping ones (a second menu, or the
// Share gate beside a menu) would each upload, or each delete, behind the other's back. Kept here
// rather than in the menu that starts it, which unmounts when it closes and forgets.
const converting = new Set<string>();

// Thrown by a conversion started while another of the same design runs. Callers stay quiet: the
// first one reports for both.
export class ConversionInProgressError extends Error {
  constructor() {
    super('offline conversion already running');
    this.name = 'ConversionInProgressError';
  }
}

export function conversionInProgress(designId: string): boolean {
  return converting.has(designId);
}

async function oneAtATime<T>(designId: string, run: () => Promise<T>): Promise<T> {
  if (converting.has(designId)) throw new ConversionInProgressError();
  converting.add(designId);
  try {
    return await run();
  } finally {
    converting.delete(designId);
  }
}

// Offline → Cloud ("Sync Design"), in ./offline-sync. Returns the (unchanged) design id and the images it
// re-homed (data URI -> gallery id), for an editor syncing in place.
export function saveOfflineToCloud(offlineId: string, ownerId: string): Promise<OfflineSyncResult> {
  return oneAtATime(offlineId, () => syncOfflineDesign(offlineId, ownerId));
}

// Cloud → Offline ("Take offline"). Downloads the whole design, writes it to
// IndexedDB, then DELETES the server record (and thus any share links). The
// local write happens first so a failed delete leaves a (harmless) duplicate
// rather than nothing. The server delete goes through the raw `apiDelete` so it
// isn't re-routed to the local store once the id is registered offline.
export function takeCloudOffline(
  designId: string,
  ownerId: string,
  shareCode: string | null = null,
): Promise<void> {
  return oneAtATime(designId, () => downloadAndRemoveCloudCopy(designId, ownerId, shareCode));
}

async function downloadAndRemoveCloudCopy(
  designId: string,
  ownerId: string,
  shareCode: string | null,
): Promise<void> {
  const liveDoc = await apiLoadDesign(ownerId, designId);
  if (!liveDoc) throw new Error('design not found');
  const fetchedTabs = (
    await Promise.all(
      liveDoc.tabs.map((s) => apiLoadTab(ownerId, designId, s.id, shareCode).catch(() => null)),
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
  // The best-effort filter is borrowed from duplicate-design.ts, where it's
  // correct because duplication leaves the source intact. Here the source is
  // destroyed, which inverts the trade. Abort exactly as the image-embed guard
  // below does, and for a stronger reason: that one protects bytes a reaper
  // might collect in 30 days, this one protects content that would be gone
  // immediately.
  if (fetchedTabs.length !== liveDoc.tabs.length) throw new Error('tab load incomplete');
  // Embed referenced R2 images as data URIs BEFORE the server delete below:
  // once the design row is gone, its images count as unused and the api's
  // 30-day retention reaper would delete the bytes the offline design still
  // points at (docs/specs/009-elements/images.md + /76).
  const tabs = await embedTabImages(fetchedTabs, { ownerId, designId, shareCode });
  // Embedding is best-effort per image, but the DELETE below is not: if any
  // image failed to embed, aborting here keeps the server copy (and its
  // images) alive instead of quietly signing the stragglers up for the
  // 30-day reaper. The caller surfaces the failure; the user can retry.
  const unembedded = tabs.some((t) => tabImageIds(t).some((id) => !isDataImageId(id)));
  if (unembedded) throw new Error('image embed incomplete');

  // The person's star is the index's, on the design's item, which the server delete below takes too; carry it onto
  // the offline record (docs/specs/013-workspace/favourites.md). A failed read aborts here, before anything is
  // written: taken as "none" it would drop it.
  const { item } = await indexClient.getItem(liveDoc.id);
  const starred = item.favourite;
  const now = Date.now();
  const rec: OfflineDesignRecord = {
    id: liveDoc.id,
    name: liveDoc.name,
    // Keep its place and its deck: the server row, the only other copy, is
    // deleted below. A team folder isn't a place in the personal tree the
    // offline record lives in, so a team design lands at the root of My Work.
    folderId: liveDoc.teamId ? null : (liveDoc.folderId ?? null),
    createdAt: liveDoc.createdAt ?? now,
    savedAt: now,
    tabs,
    ...(liveDoc.presentation ? { presentation: liveDoc.presentation } : {}),
    ...(starred ? { favourite: true } : {}),
  };
  await offlinePutRecord(rec);
  // Raw server delete — the id is now in the offline index, so the dispatching
  // apiDeleteDesign would target the local store instead of the server.
  try {
    // Declare the conversion: this DELETE is indistinguishable from a real
    // delete at the boundary, and undeclared the feed told the owner their
    // design had been deleted (docs/specs/006-design/offline-mode.md + docs/specs/013-workspace/timeline.md).
    await apiDelete(`${API_BASE}/designs/${designId}`, ownerId, {
      action: 'take offline',
      extra: { [DESIGN_CONVERSION_HEADER]: 'offline' },
    });
  } catch (e) {
    // The server copy survived, so ROLL BACK the local copy: leaving both
    // registered under one id would shadow the live cloud design behind a
    // stale offline fork (and duplicate the Explorer row). Data-safe: the
    // server still holds everything.
    await offlineDeleteDesign(rec.id).catch(() => {});
    throw e;
  }
}

// Toast copy for a failed Sync Design, shared by the Explorer menus (via
// useOfflineConversion) and the Share dialog's offline gate. A 413 is the
// hard per-tab size cap (usually a large embedded image whose gallery
// upload failed, leaving the data URI in the tab JSON): retrying won't
// help, so it must not read as a connection problem.
// A sync from inside the editor that found this browser's last save still going after
// SYNC_SAVE_WAIT_MS (app/design/[id]/useSyncInPlace.ts): refused rather than racing it.
export class SyncStillSavingError extends Error {
  constructor() {
    super('Still saving this design. Try again in a moment.');
    this.name = 'SyncStillSavingError';
  }
}

// A sync stopped by its own checks (./offline-sync) names what happened: the local copy is kept
// either way, and a retry is the fix.
export function syncFailureMessage(e: unknown): string {
  if (e instanceof SyncStillSavingError) return e.message;
  if (e instanceof OfflineSyncIncompleteError)
    return 'This design kept changing while syncing. Your copy is safe: try again soon.';
  return e instanceof ApiError && e.status === 413
    ? 'Too large to sync, usually a big image on a tab. Shrink it and try again.'
    : 'Could not sync this design. Check your connection and try again.';
}

// Re-exported for callers that only need to create an offline design from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateDesign };
