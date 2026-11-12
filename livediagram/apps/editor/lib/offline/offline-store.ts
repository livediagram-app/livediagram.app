// Offline Mode (docs/specs/006-document/offline-mode.md): documents saved only in THIS browser, in IndexedDB,
// never to the API. This module is the local counterpart of `lib/api/*`, it
// produces the same wire shapes (LiveDoc / DocumentSummary / Tab) so the editor
// and Explorer render an offline document exactly like a cloud one; the
// persistence dispatch in `lib/api/*` routes to these when a document id is
// registered offline (see `isOfflineId`).
//
// Storage: one IndexedDB record per document, holding its meta + all tab bodies
// inline (offline documents load whole, no lazy per-tab fetch). The set of
// offline ids IS the set of record keys, mirrored in an in-memory cache so the
// dispatch can answer "is this id offline?" cheaply (./offline-ids, which keeps
// every tab of the browser in step).

import type { LiveDoc, DocumentSummary, RecordedIntent, TabSummary } from '@livediagram/api-schema';
import { utcDay } from '@livediagram/api-schema';
import { drawnCount, migrateStoredTab, stampTabKind } from '@livediagram/document';
import type { Tab } from '@livediagram/document';
import { DocumentTrashedError } from '../document-trashed';
import {
  offlineBackend,
  setOfflineBackend,
  type OfflineBackend,
  type OfflineRecordChange,
} from './offline-backend';
import {
  forgetOfflineId,
  isOfflineIdSync,
  rememberOfflineId,
  resetOfflineIds,
} from './offline-ids';
import { offlineDocumentStats } from './offline-stats';
import { noteThisBrowser } from './this-browser';
import {
  applyMeta as applyMetaShared,
  createOfflineStore,
  removeTab as removeTabShared,
  tabToSummaryFor,
  upsertTabWith,
  type OfflineDeleteOutcome,
} from '@liveworkspace/workbench/lib/offline/offline-store-core';

// Sentinel owner id stamped on offline documents. They have no server owner;
// this keeps the wire shape valid and is never sent anywhere.
export const OFFLINE_OWNER_ID = 'offline';

// The stored shape for one offline document.
export type OfflineDocumentRecord = {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: number;
  savedAt: number;
  tabs: Tab[];
  // Slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised StoredPresentation. Offline documents get
  // decks for the same reason they get everything else: Offline Mode is the
  // whole product minus the server, not a reduced one. Optional so records
  // written before the field existed stay valid.
  presentation?: string | null;
  // Starred in the Explorer (docs/specs/013-workspace/favourites.md). A canvas's star is the index's, on its item,
  // which an offline canvas has none of, so its star has to live here instead. Optional so records
  // written before the field existed stay valid.
  favourite?: boolean;
  // When the canvas was moved to this browser's local Trash (docs/specs/013-workspace/trash.md). Absent = live.
  // A trashed record keeps everything else so a restore is exact.
  trashedAt?: number;
  // This Browser's opens of the document (docs/specs/013-workspace/explorer-home.md "Opens"),
  // for Home's Recent; see ./offline-opens.ts. Optional: a record never opened has none.
  opens?: StoredLocalOpens;
};

// A local document's opens, counted like the server's (docs/specs/013-workspace/explorer-home.md
// "Opens"): the UTC days (`YYYY-MM-DD`, newest first) with an open inside the 90-day use window,
// and the last open.
export type LocalOpens = { days: string[]; lastOpenedAt: number };

// What a record may hold: the current shape, or the one records were written in before Within
// reach. Read through `localOpensOf` (offline-opens.ts); the next open rewrites it.
export type StoredLocalOpens =
  LocalOpens | { openDays: number; lastOpenDay: string; lastOpenedAt: number; frecencyKey: number };

// ---------------------------------------------------------------------------
// Pure transforms (unit-tested, no IndexedDB involved)
// ---------------------------------------------------------------------------

export const tabToSummary: (
  tab: Tab,
  documentId: string,
  orderIndex: number,
  at: number,
) => TabSummary = tabToSummaryFor('documentId');

// No creation intent is recorded in the browser: unknown, never Diagram
// (docs/specs/013-workspace/default-folders.md "Recorded intent").
const UNKNOWN_INTENT: RecordedIntent = { opensIn: null, tabKind: null, templateFamily: null };

// Project a stored record into the full `LiveDoc` the editor hydrates from.
// The server-only fields take their inert defaults (unshared, no team, no
// provenance, no owner join), offline documents are private by construction.
export function recordToDocument(rec: OfflineDocumentRecord): LiveDoc {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    tabs: rec.tabs.map((t, i) => tabToSummary(t, rec.id, i, rec.savedAt)),
    presentation: rec.presentation ?? null,
    shareable: false,
    shareCode: null,
    folderId: rec.folderId,
    teamId: null,
    source: null,
    savedAt: rec.savedAt,
    createdAt: rec.createdAt,
    ownerName: null,
    ownerColor: null,
    ...UNKNOWN_INTENT,
  };
}

// Project a record into a list row (drops tab bodies).
export function recordToSummary(rec: OfflineDocumentRecord): DocumentSummary {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    shareable: false,
    shareCode: null,
    // Saved only in this browser: never in the Community.
    communityListed: false,
    folderId: rec.folderId,
    teamId: null,
    source: null,
    ...UNKNOWN_INTENT,
    savedAt: rec.savedAt,
    createdAt: rec.createdAt,
    empty: drawnCount(rec.tabs[0] ?? {}) === 0,
    stats: offlineDocumentStats(rec),
  };
}

// Apply a document-meta change (rename + tab order/folder) to a record,
// returning a new record. Mirrors `apiSaveDocumentMeta`: `tabs` (when given)
// reorders the existing tab bodies by id and refreshes each tab's folder.
export function applyMeta(
  rec: OfflineDocumentRecord,
  patch: {
    name?: string;
    tabs?: { id: string; folder?: string }[];
    // Absent leaves the stored deck alone; null clears it. Same contract as
    // the server's PUT, so an offline document behaves identically.
    presentation?: string | null;
  },
  at: number,
): OfflineDocumentRecord {
  return applyMetaShared(rec, patch, at);
}

// Upsert one tab body into a record (the autosave path). A new tab id is
// appended; an existing one is replaced in place, preserving order.
export function upsertTab(rec: OfflineDocumentRecord, tab: Tab, at: number): OfflineDocumentRecord {
  return upsertTabWith(rec, tab, at, stampTabKind);
}

export function removeTab(
  rec: OfflineDocumentRecord,
  tabId: string,
  at: number,
): OfflineDocumentRecord {
  return removeTabShared(rec, tabId, at);
}

// ---------------------------------------------------------------------------
// Storage backend (./offline-backend) and the id cache (./offline-ids)
// ---------------------------------------------------------------------------

export {
  OFFLINE_STORE_OPEN_TIMEOUT_MS,
  offlineBackend,
  type OfflineBackend,
  type OfflineRecordChange,
} from './offline-backend';
export { isOfflineId, isOfflineIdSync, offlineIdCount, subscribeOfflineIds } from './offline-ids';

// Test seam: swap in an in-memory backend. Also resets the id cache.
export function __setOfflineBackend(b: OfflineBackend | null): void {
  setOfflineBackend(b);
  resetOfflineIds();
}

// Thrown by a write whose record is gone while this tab still lists the id: another tab synced it
// to the cloud or purged it, and the write has nowhere to land. The id is forgotten first, so the
// autosave shows the failure instead of "Saved" and its retry routes where the document now is.
export class OfflineDocumentMissingError extends Error {
  constructor(id: string) {
    super(`offline document ${id} is no longer in this browser`);
    this.name = 'OfflineDocumentMissingError';
  }
}

// ---------------------------------------------------------------------------
// Public operations, the local mirror of the document/tab api surface
// ---------------------------------------------------------------------------

// The shared operations (@liveworkspace/workbench/lib/offline/offline-store-core): one write chain serialises every
// read-modify-write op in this browser tab, each one IndexedDB transaction.
const store = createOfflineStore<
  Tab,
  OfflineDocumentRecord,
  ReturnType<typeof recordToDocument>,
  ReturnType<typeof recordToSummary>
>({
  // Read at call time, as the operations always did (the offline modules import each other).
  backend: () => offlineBackend(),
  rememberId: (id) => rememberOfflineId(id),
  forgetId: (id) => forgetOfflineId(id),
  isOfflineIdSync: (id) => isOfflineIdSync(id),
  noteThisBrowser: (id, after) => noteThisBrowser(id, after),
  toItem: recordToDocument,
  toSummary: recordToSummary,
  migrateTab: (tab) => migrateStoredTab(tab),
  trashedError: (id) => new DocumentTrashedError(id),
  missingError: (id) => new OfflineDocumentMissingError(id),
});

export const serializeOfflineWrite = store.serializeOfflineWrite;

// Read-modify-write one record in a single transaction. Callers run it inside serializeOfflineWrite.
export const offlineUpdateRecord: (id: string, change: OfflineRecordChange) => Promise<void> =
  store.offlineUpdateRecord;

// The editor's writes to a live record: a no-op once this tab forgot the id, OfflineDocumentMissingError while it
// still lists it.
const writeLive = store.writeLive;

// Live records only: a trashed one waits in the local Trash.
export const offlineListDocuments = store.listItems;

// A trashed record reads as the deleted state, the local twin of the api's 410.
export const offlineLoadDocument = store.loadItem;

export const offlineLoadTab = store.loadTab;

// `extra`: a document's own created and last-modified dates (an imported board,
// docs/specs/015-api/api.md "Document dates"), absent now; the personal folder it is filed in.
// Making a document here is a use of it, unless it came in a bulk import (`markUsed: false`): its
// record of uses starts with the day and the moment it was made, as a first open would
// (docs/specs/013-workspace/explorer-home.md "Making a document"; offline-opens.ts).
export async function offlineCreateDocument(
  d: { id: string; name: string; tabs?: Tab[] },
  now: number,
  extra: {
    createdAt?: number;
    savedAt?: number;
    folderId?: string | null;
    markUsed?: boolean;
  } = {},
): Promise<LiveDoc> {
  const rec: OfflineDocumentRecord = {
    id: d.id,
    name: d.name,
    folderId: extra.folderId ?? null,
    createdAt: extra.createdAt ?? now,
    savedAt: extra.savedAt ?? now,
    tabs: d.tabs ?? [],
    ...(extra.markUsed === false ? {} : { opens: { days: [utcDay(now)], lastOpenedAt: now } }),
  };
  return store.createRecord(rec);
}

export async function offlineSaveDocumentMeta(
  id: string,
  patch: { name?: string; tabs?: { id: string; folder?: string }[]; presentation?: string | null },
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => applyMeta(rec, patch, now));
}

// Star / un-star an offline document (docs/specs/013-workspace/favourites.md). The savedAt stamp is left
// alone on purpose: a star is a per-user bookmark, not an edit to the
// document, and bumping it would reorder Recent on a click that changed
// nothing about the content.
export const offlineSetFavourite = store.setFavourite;

export const offlineListFavouriteIds = store.listFavouriteIds;

export async function offlineSaveTab(id: string, tab: Tab, now: number): Promise<void> {
  // No create-on-missing: a save must never resurrect a deleted document.
  // A pending debounced autosave can land AFTER a sync-to-cloud deleted
  // the record; recreating it here would shadow the freshly-synced cloud
  // copy behind a 1-tab offline ghost (the local analog of the server's
  // old create-on-first-write bug). Records are only ever created by
  // offlineCreateDocument / offlinePutRecord.
  await writeLive(id, (rec) => upsertTab(rec, tab, now));
}

export const offlineDeleteTab = store.deleteTab;

export const offlineDeleteDocument = store.deleteItem;

// Sync Canvas's last step (docs/specs/006-document/offline-mode.md "Save to server"): remove the
// record only if it still matches what was uploaded, judged and done in one transaction so no write
// (from this tab or another) can land between the check and the delete. Answers what it found:
// `deleted` (with the record as it was), `changed` (with the record as it is now) or `missing`.
export const offlineDeleteIfUnchanged: (
  id: string,
  unchanged: (rec: OfflineDocumentRecord) => boolean,
) => Promise<OfflineDeleteOutcome<OfflineDocumentRecord>> = store.offlineDeleteIfUnchanged;

// Read the raw record, used by the Offline → Cloud conversion (docs/specs/006-document/offline-mode.md) to
// upload the whole document, and by "take offline" to seed one.
export const offlineGetRecord = store.offlineGetRecord;

export const offlinePutRecord = store.offlinePutRecord;
