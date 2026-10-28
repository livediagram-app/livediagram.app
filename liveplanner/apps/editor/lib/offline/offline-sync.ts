// Offline → Cloud ("Sync Project", docs/specs/006-project/offline-mode.md "Save to server").
// Creates the cloud copy first, then removes the local one, so a network failure leaves the
// offline project intact. `apiCreateProject` does not dispatch on the offline index, so it
// always writes to the server even while the id is still registered offline.
//
// The upload takes seconds, and the project stays editable (and writable from another tab)
// while it runs. So the local copy is removed only if it still matches what went up, checked and
// deleted in one transaction; a change in between takes the cloud copy back and uploads again.
// And the cloud copy must hold every card and sheet before the local one goes: a create that
// resolves to an existing row (a retry after a half-finished sync) never re-seeds those stores.

import { storeAsCreates, type ItemCreate } from '@liveplanner/items';
import { threadsOnCard, withoutLegacyThread } from '@liveplanner/project';
import { recordThreads } from './offline-threads';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';
import { apiCreateProject } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { fetchCloudItems } from '../api/items';
import { fetchCloudSheets, sheetAsCreate } from '../api/sheets';
import {
  offlineDeleteIfUnchanged,
  offlineGetRecord,
  type OfflineProjectRecord,
} from './offline-store';

// How many times a sync uploads a project that keeps changing under it before giving up. Each
// change during the upload costs one more upload; three covers a person still typing for a few
// seconds after choosing Sync Project, without retrying forever against a busy other tab.
const SYNC_UPLOAD_ATTEMPTS = 3;

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
function uploadMark(rec: OfflineProjectRecord): string {
  return JSON.stringify([
    rec.savedAt,
    rec.itemsRev ?? 0,
    (rec.sheets ?? []).map((s) => [s.id, s.rev, s.updatedAt]),
  ]);
}

// What a finished sync hands back: the (unchanged) project id (docs/specs/006-project/offline-mode.md
// "Syncing in place").
export type OfflineSyncResult = { id: string };

// The creates, each carrying the threads its card is on.
function withThreads(creates: ItemCreate[], rec: OfflineProjectRecord): ItemCreate[] {
  const threads = recordThreads(rec);
  if (threads.length === 0) return creates;
  return creates.map((c) => {
    const on = c.id ? threadsOnCard(threads, rec.id, c.id) : [];
    return on.length ? { ...c, threads: on } : c;
  });
}

// Uploads the record.
async function upload(rec: OfflineProjectRecord, ownerId: string): Promise<void> {
  const tabs = rec.tabs;
  // Declare the conversion so the feed says "Synced to the Cloud" rather than
  // reporting a brand-new project (docs/specs/006-project/offline-mode.md + docs/specs/013-workspace/timeline.md).
  // Everything the record holds besides tabs travels too: the local copy is
  // deleted next, so a deck or placement left behind is gone for good.
  const create = (folderId: string | null) =>
    apiCreateProject(
      ownerId,
      {
        id: rec.id,
        name: rec.name,
        tabs,
        folderId,
        createdAt: rec.createdAt,
        // The item store, in each column's order (docs/specs/026-plan/items.md "Offline projects").
        // Each card with the comment threads it is on (docs/specs/026-plan/items.md "Offline projects"): the first
        // card's create brings a thread up whole, each other's puts its card on it.
        items: withThreads(storeAsCreates((rec.items ?? []).map(withoutLegacyThread)), rec),
        // And its type catalogue (docs/specs/026-plan/item-types.md "Storage and sync").
        itemTypes: rec.itemTypes ?? null,
        // The sheet store, whole (docs/specs/029-sheets/sheet-store.md "Offline projects").
        ...(rec.sheets?.length ? { sheets: rec.sheets.map(sheetAsCreate) } : {}),
      },
      { conversion: 'sync' },
    );
  try {
    await create(rec.folderId ?? null);
  } catch (err) {
    // The server refuses a folder deleted since, or not the caller's, by name and writes nothing
    // (docs/specs/013-workspace/folders.md "Placement on create"). The sync files the project in
    // the root of My Work instead, on its own say-so, rather than losing the conversion over a folder.
    const code = err instanceof ApiError ? err.code : null;
    if (code !== 'folder_not_found' && code !== 'folder_scope_mismatch') throw err;
    console.warn(`[offline-sync] placement refused reason=${code}, filed at root`);
    await create(null);
  }
}

// True when the cloud copy holds as many cards and sheets as the record. Skips the fetch for a
// record with none (the common case: a diagram-only project).
async function cloudHoldsStores(rec: OfflineProjectRecord, ownerId: string): Promise<boolean> {
  const scope = { ownerId, projectId: rec.id, shareCode: null, tabId: null };
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
    await apiDelete(`${API_BASE}/projects/${id}`, ownerId, {
      action: 'sync take back',
      extra: { [PROJECT_CONVERSION_HEADER]: 'offline' },
    });
  } catch (err) {
    console.warn('[offline-sync] take-back failed', err);
  }
}

// Callers go through ./offline-convert's saveOfflineToCloud, which refuses a second conversion of the
// same project while one runs. A retry uploads the record as it changed.
export async function syncOfflineProject(
  offlineId: string,
  ownerId: string,
): Promise<OfflineSyncResult> {
  let rec = await offlineGetRecord(offlineId);
  if (!rec) throw new Error('offline project not found');
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
    if (done.outcome === 'missing') return { id: rec.id };
    if (done.outcome === 'deleted') {
      // The star lived on the offline record (docs/specs/013-workspace/favourites.md), which just went: it goes onto
      // the plan's index item, which the upload made. A failed star leaves the plan synced, unstarred.
      if (done.rec.favourite) await indexClient.favourite(rec.id).catch(() => {});
      return { id: rec.id };
    }
    console.warn(`[offline-sync] changed-during-upload attempt=${attempt}`);
    await takeBackCloudCopy(rec.id, ownerId);
    if (attempt >= SYNC_UPLOAD_ATTEMPTS) throw new OfflineSyncIncompleteError('kept_changing');
    rec = done.rec;
  }
}
