// Offline Mode conversions (docs/specs/006-project/offline-mode.md): move a project between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the project: the destination is
// written before the source is removed. Taking a cloud project offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { fetchItems } from '../api/items';
import { fetchCloudThreads } from '../api/card-threads';
import { apiLoadProject, apiLoadTab } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import {
  offlineCreateProject,
  offlineDeleteProject,
  offlinePutRecord,
  type OfflineProjectRecord,
} from './offline-store';
import { fetchAllSheets } from '../api/sheets';
import {
  OfflineSyncIncompleteError,
  syncOfflineProject,
  type OfflineSyncResult,
} from './offline-sync';

// One conversion per project at a time, in this tab: two overlapping ones (a second menu, or the
// Share gate beside a menu) would each upload, or each delete, behind the other's back. Kept here
// rather than in the menu that starts it, which unmounts when it closes and forgets.
const converting = new Set<string>();

// Thrown by a conversion started while another of the same project runs. Callers stay quiet: the
// first one reports for both.
export class ConversionInProgressError extends Error {
  constructor() {
    super('offline conversion already running');
    this.name = 'ConversionInProgressError';
  }
}

export function conversionInProgress(projectId: string): boolean {
  return converting.has(projectId);
}

async function oneAtATime<T>(projectId: string, run: () => Promise<T>): Promise<T> {
  if (converting.has(projectId)) throw new ConversionInProgressError();
  converting.add(projectId);
  try {
    return await run();
  } finally {
    converting.delete(projectId);
  }
}

// Offline → Cloud ("Sync Project"), in ./offline-sync. Returns the (unchanged) project id, for an editor
// syncing in place.
export function saveOfflineToCloud(offlineId: string, ownerId: string): Promise<OfflineSyncResult> {
  return oneAtATime(offlineId, () => syncOfflineProject(offlineId, ownerId));
}

// Cloud → Offline ("Take offline"). Downloads the whole project, writes it to
// IndexedDB, then DELETES the server record (and thus any share links). The
// local write happens first so a failed delete leaves a (harmless) duplicate
// rather than nothing. The server delete goes through the raw `apiDelete` so it
// isn't re-routed to the local store once the id is registered offline.
export function takeCloudOffline(
  projectId: string,
  ownerId: string,
  shareCode: string | null = null,
): Promise<void> {
  return oneAtATime(projectId, () => downloadAndRemoveCloudCopy(projectId, ownerId, shareCode));
}

async function downloadAndRemoveCloudCopy(
  projectId: string,
  ownerId: string,
  shareCode: string | null,
): Promise<void> {
  const liveDoc = await apiLoadProject(ownerId, projectId);
  if (!liveDoc) throw new Error('project not found');
  const fetchedTabs = (
    await Promise.all(
      liveDoc.tabs.map((s) => apiLoadTab(ownerId, projectId, s.id, shareCode).catch(() => null)),
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
  // The best-effort filter is borrowed from duplicate-project.ts, where it's
  // correct because duplication leaves the source intact. Here the source is
  // destroyed, which inverts the trade: the content would be gone immediately.
  if (fetchedTabs.length !== liveDoc.tabs.length) throw new Error('tab load incomplete');
  // The item store too, all or nothing, for the same reason: the server copy is deleted below
  // (docs/specs/026-plan/items.md "Offline projects"). A failed fetch throws and aborts.
  const itemStore = await fetchItems({ ownerId, projectId, shareCode, tabId: null });
  // And the sheet store, all or nothing (docs/specs/029-sheets/sheet-store.md "Offline projects").
  const sheets = await fetchAllSheets({ ownerId, projectId, shareCode, tabId: null });
  // And the comment threads the plan stores (docs/specs/026-plan/items.md "Cards coming and going"), on its own cards:
  // a thread shared in from another plan stays that plan's.
  const threads = (await fetchCloudThreads({ ownerId, projectId, shareCode, tabId: null })).flatMap(
    (t) => {
      if (t.home !== projectId) return [];
      const cards = t.cards.filter((c) => c.projectId === projectId);
      return cards.length ? [{ ...t, cards }] : [];
    },
  );
  const tabs = fetchedTabs;

  // The person's star is the index's, on the plan's item, which the server delete below takes too; carry it onto
  // the offline record (docs/specs/013-workspace/favourites.md). A failed read aborts here, before anything is
  // written: taken as "none" it would drop it.
  const { item } = await indexClient.getItem(liveDoc.id);
  const starred = item.favourite;
  const now = Date.now();
  const rec: OfflineProjectRecord = {
    id: liveDoc.id,
    name: liveDoc.name,
    // Keep its place: the server row, the only other copy, is
    // deleted below. A team folder isn't a place in the personal tree the
    // offline record lives in, so a team project lands at the root of My Work.
    folderId: liveDoc.teamId ? null : (liveDoc.folderId ?? null),
    createdAt: liveDoc.createdAt ?? now,
    savedAt: now,
    tabs,
    ...(starred ? { favourite: true } : {}),
    ...(liveDoc.itemTypes ? { itemTypes: liveDoc.itemTypes } : {}),
    ...(itemStore.items.length
      ? { items: itemStore.items, itemsRev: itemStore.rev, itemsNextKey: itemStore.nextKey }
      : {}),
    ...(sheets.length ? { sheets } : {}),
    ...(threads.length ? { threads } : {}),
  };
  await offlinePutRecord(rec);
  // Raw server delete — the id is now in the offline index, so the dispatching
  // apiDeleteProject would target the local store instead of the server.
  try {
    // Declare the conversion: this DELETE is indistinguishable from a real
    // delete at the boundary, and undeclared the feed told the owner their
    // project had been deleted (docs/specs/006-project/offline-mode.md + docs/specs/013-workspace/timeline.md).
    await apiDelete(`${API_BASE}/projects/${projectId}`, ownerId, {
      action: 'take offline',
      extra: { [PROJECT_CONVERSION_HEADER]: 'offline' },
    });
  } catch (e) {
    // The server copy survived, so ROLL BACK the local copy: leaving both
    // registered under one id would shadow the live cloud project behind a
    // stale offline fork (and duplicate the Explorer row). Data-safe: the
    // server still holds everything.
    await offlineDeleteProject(rec.id).catch(() => {});
    throw e;
  }
}

// Toast copy for a failed Sync Project, shared by the Explorer menus (via
// useOfflineConversion) and the Share dialog's offline gate. A 413 is the
// hard per-tab size cap (usually a large embedded image whose gallery
// upload failed, leaving the data URI in the tab JSON): retrying won't
// help, so it must not read as a connection problem.
// A sync from inside the editor that found this browser's last save still going after
// SYNC_SAVE_WAIT_MS (app/project/[id]/useSyncInPlace.ts): refused rather than racing it.
export class SyncStillSavingError extends Error {
  constructor() {
    super('Still saving this plan. Try again in a moment.');
    this.name = 'SyncStillSavingError';
  }
}

// A sync stopped by its own checks (./offline-sync) names what happened: the local copy is kept
// either way, and a retry is the fix.
export function syncFailureMessage(e: unknown): string {
  if (e instanceof SyncStillSavingError) return e.message;
  if (e instanceof OfflineSyncIncompleteError)
    return e.reason === 'kept_changing'
      ? 'This plan kept changing while syncing. Your copy is safe: try again soon.'
      : 'The cloud copy was missing cards or sheets, so yours was kept. Try again.';
  return e instanceof ApiError && e.status === 413
    ? 'Too large to sync, usually a big image on a tab. Shrink it and try again.'
    : 'Could not sync this plan. Check your connection and try again.';
}

// Re-exported for callers that only need to create an offline project from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateProject };
