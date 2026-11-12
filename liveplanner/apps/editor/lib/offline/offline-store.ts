// Offline Mode (docs/specs/006-project/offline-mode.md): projects saved only in THIS browser, in IndexedDB,
// never to the API. This module is the local counterpart of `lib/api/*`, it
// produces the same wire shapes (Project / ProjectSummary / Tab) so the editor
// and Explorer render an offline project exactly like a cloud one; the
// persistence dispatch in `lib/api/*` routes to these when a project id is
// registered offline (see `isOfflineId`).
//
// Storage: one IndexedDB record per project, holding its meta + all tab bodies
// inline (offline projects load whole, no lazy per-tab fetch). The set of
// offline ids IS the set of record keys, mirrored in an in-memory cache so the
// dispatch can answer "is this id offline?" cheaply (./offline-ids, which keeps
// every tab of the browser in step).

import type { SheetJson } from '@liveplanner/sheets';
import type { Project, ProjectSummary, RecordedIntent, TabSummary } from '@liveplanner/api-schema';
import { utcDay } from '@liveplanner/api-schema';
import { drawnCount, migrateStoredTab, stampTabKind } from '@liveplanner/project';
import type { CardThread, Tab } from '@liveplanner/project';
import {
  legacyCatalogue,
  readItemTypeCatalogue,
  type Item,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import { ProjectTrashedError } from '../project-trashed';
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
import { offlineProjectStats } from './offline-stats';
import { noteThisBrowser } from './this-browser';
import {
  applyMeta as applyMetaShared,
  createOfflineStore,
  removeTab as removeTabShared,
  tabToSummaryFor,
  upsertTabWith,
  type OfflineDeleteOutcome,
} from '@liveworkspace/workbench/lib/offline/offline-store-core';

// Sentinel owner id stamped on offline projects. They have no server owner;
// this keeps the wire shape valid and is never sent anywhere.
export const OFFLINE_OWNER_ID = 'offline';

// The stored shape for one offline project.
export type OfflineProjectRecord = {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: number;
  savedAt: number;
  tabs: Tab[];
  // Starred in the Explorer (docs/specs/013-workspace/favourites.md). Cloud stars live in a D1 table whose
  // project_id is a foreign key into `projects`, which an offline project has
  // no row in, so its star has to live here instead. Optional so records
  // written before the field existed stay valid.
  favourite?: boolean;
  // When the project was moved to this browser's local Trash
  // (docs/specs/013-workspace/trash.md). Absent = live.
  // A trashed record keeps everything else so a restore is exact.
  trashedAt?: number;
  // This Browser's opens of the project (docs/specs/013-workspace/explorer-home.md "Opens"),
  // for Home's Recent; see ./offline-opens.ts. Optional: a record never opened has none.
  opens?: StoredLocalOpens;
  // The project's item store (docs/specs/026-plan/items.md "Offline projects"): its items, the
  // store's revision and the next item key. Optional: a record without them has an empty store.
  items?: Item[];
  itemsRev?: number;
  itemsNextKey?: number;
  // The type catalogue (docs/specs/026-plan/item-types.md), absent or null for the default types.
  itemTypes?: ItemTypeCatalogue | null;
  // The project's sheet store (docs/specs/029-sheets/sheet-store.md "Offline projects"): every sheet, cells
  // included. Optional: a record without it has none.
  sheets?: SheetJson[];
  // The cards' comment threads (docs/specs/026-plan/items.md "Comments", "Offline projects"), each stored once here
  // and on this plan's cards alone. Optional: a record without them has none, or (written before threads) holds each
  // card's old single thread in its `fields.comments`, read as its first thread (offline-threads.ts).
  threads?: CardThread[];
};

// A local project's opens, counted like the server's (docs/specs/013-workspace/explorer-home.md
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
  projectId: string,
  orderIndex: number,
  at: number,
) => TabSummary = tabToSummaryFor('projectId');

// No creation intent is recorded in the browser: unknown, never Diagram
// (docs/specs/013-workspace/default-folders.md "Recorded intent").
const UNKNOWN_INTENT: RecordedIntent = { opensIn: null, tabKind: null, templateFamily: null };

// Project a stored record into the full `Project` the editor hydrates from.
// The server-only fields take their inert defaults (unshared, no team, no
// provenance, no owner join), offline projects are private by construction.
export function recordToProject(rec: OfflineProjectRecord): Project {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    tabs: rec.tabs.map((t, i) => tabToSummary(t, rec.id, i, rec.savedAt)),
    itemTypes: legacyCatalogue(
      readItemTypeCatalogue(rec.itemTypes ?? null),
      (rec.items?.length ?? 0) > 0,
    ),
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
export function recordToSummary(rec: OfflineProjectRecord): ProjectSummary {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    shareable: false,
    shareCode: null,
    folderId: rec.folderId,
    teamId: null,
    source: null,
    ...UNKNOWN_INTENT,
    savedAt: rec.savedAt,
    createdAt: rec.createdAt,
    empty: drawnCount(rec.tabs[0] ?? {}) === 0,
    stats: offlineProjectStats(rec),
  };
}

// Apply a project-meta change (rename + tab order/folder) to a record,
// returning a new record. Mirrors `apiSaveProjectMeta`: `tabs` (when given)
// reorders the existing tab bodies by id and refreshes each tab's folder.
export function applyMeta(
  rec: OfflineProjectRecord,
  patch: {
    name?: string;
    tabs?: { id: string; folder?: string }[];
  },
  at: number,
): OfflineProjectRecord {
  return applyMetaShared(rec, patch, at);
}

// Upsert one tab body into a record (the autosave path). A new tab id is
// appended; an existing one is replaced in place, preserving order.
export function upsertTab(rec: OfflineProjectRecord, tab: Tab, at: number): OfflineProjectRecord {
  return upsertTabWith(rec, tab, at, stampTabKind);
}

export function removeTab(
  rec: OfflineProjectRecord,
  tabId: string,
  at: number,
): OfflineProjectRecord {
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
// autosave shows the failure instead of "Saved" and its retry routes where the project now is.
export class OfflineProjectMissingError extends Error {
  constructor(id: string) {
    super(`offline project ${id} is no longer in this browser`);
    this.name = 'OfflineProjectMissingError';
  }
}

// ---------------------------------------------------------------------------
// Public operations, the local mirror of the project/tab api surface
// ---------------------------------------------------------------------------

// The shared operations (@liveworkspace/workbench/lib/offline/offline-store-core): one write chain serialises every
// read-modify-write op in this browser tab, each one IndexedDB transaction.
const store = createOfflineStore<
  Tab,
  OfflineProjectRecord,
  ReturnType<typeof recordToProject>,
  ReturnType<typeof recordToSummary>
>({
  // Read at call time, as the operations always did (the offline modules import each other).
  backend: () => offlineBackend(),
  rememberId: (id) => rememberOfflineId(id),
  forgetId: (id) => forgetOfflineId(id),
  isOfflineIdSync: (id) => isOfflineIdSync(id),
  noteThisBrowser: (id, after) => noteThisBrowser(id, after),
  toItem: recordToProject,
  toSummary: recordToSummary,
  migrateTab: (tab) => migrateStoredTab(tab),
  trashedError: (id) => new ProjectTrashedError(id),
  missingError: (id) => new OfflineProjectMissingError(id),
});

export const serializeOfflineWrite = store.serializeOfflineWrite;

// Read-modify-write one record in a single transaction. Callers run it inside serializeOfflineWrite.
export const offlineUpdateRecord: (id: string, change: OfflineRecordChange) => Promise<void> =
  store.offlineUpdateRecord;

// The editor's writes to a live record: a no-op once this tab forgot the id, OfflineProjectMissingError while it
// still lists it.
const writeLive = store.writeLive;

// Live records only: a trashed one waits in the local Trash.
export const offlineListProjects = store.listItems;

// A trashed record reads as the deleted state, the local twin of the api's 410.
export const offlineLoadProject = store.loadItem;

export const offlineLoadTab = store.loadTab;

// `extra`: a project's own created and last-modified dates (docs/specs/015-api/api.md "Project
// dates"), absent now; the personal folder it is filed in. Making a project here is a use of it: its
// record of uses starts with the day and the moment it was made, as a first open would
// (docs/specs/013-workspace/explorer-home.md "Making a project"; offline-opens.ts).
export async function offlineCreateProject(
  // `itemTypes`: the type catalogue it starts with (a Plan template's brought types), already validated.
  // `sheets`: the sheets it starts with (a Plan template's, docs/specs/029-sheets/sheet-store.md "Template starts").
  d: {
    id: string;
    name: string;
    tabs?: Tab[];
    itemTypes?: ItemTypeCatalogue | null;
    sheets?: SheetJson[];
  },
  now: number,
  extra: {
    createdAt?: number;
    savedAt?: number;
    folderId?: string | null;
  } = {},
): Promise<Project> {
  const rec: OfflineProjectRecord = {
    id: d.id,
    name: d.name,
    folderId: extra.folderId ?? null,
    createdAt: extra.createdAt ?? now,
    savedAt: extra.savedAt ?? now,
    tabs: d.tabs ?? [],
    ...(d.itemTypes ? { itemTypes: d.itemTypes } : {}),
    ...(d.sheets?.length ? { sheets: d.sheets } : {}),
    opens: { days: [utcDay(now)], lastOpenedAt: now },
  };
  return store.createRecord(rec);
}

export async function offlineSaveProjectMeta(
  id: string,
  patch: { name?: string; tabs?: { id: string; folder?: string }[] },
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => applyMeta(rec, patch, now));
}

// An offline project's type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"), already
// validated by the caller; null goes back to the default types.
export async function offlineSaveItemTypes(
  id: string,
  itemTypes: ItemTypeCatalogue | null,
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => ({ ...rec, itemTypes, savedAt: now }));
}

export async function offlineSaveTab(id: string, tab: Tab, now: number): Promise<void> {
  // No create-on-missing: a save must never resurrect a deleted project.
  // A pending debounced autosave can land AFTER a sync-to-cloud deleted
  // the record; recreating it here would shadow the freshly-synced cloud
  // copy behind a 1-tab offline ghost (the local analog of the server's
  // old create-on-first-write bug). Records are only ever created by
  // offlineCreateProject / offlinePutRecord.
  await writeLive(id, (rec) => upsertTab(rec, tab, now));
}

export const offlineDeleteTab = store.deleteTab;

export const offlineDeleteProject = store.deleteItem;

// Sync Project's last step (docs/specs/006-project/offline-mode.md "Save to server"): remove the
// record only if it still matches what was uploaded, judged and done in one transaction so no write
// (from this tab or another) can land between the check and the delete. Answers what it found:
// `deleted` (with the record as it was), `changed` (with the record as it is now) or `missing`.
export const offlineDeleteIfUnchanged: (
  id: string,
  unchanged: (rec: OfflineProjectRecord) => boolean,
) => Promise<OfflineDeleteOutcome<OfflineProjectRecord>> = store.offlineDeleteIfUnchanged;

// Read the raw record, used by the Offline → Cloud conversion (docs/specs/006-project/offline-mode.md) to
// upload the whole project, and by "take offline" to seed one.
export const offlineGetRecord = store.offlineGetRecord;

export const offlinePutRecord = store.offlinePutRecord;
