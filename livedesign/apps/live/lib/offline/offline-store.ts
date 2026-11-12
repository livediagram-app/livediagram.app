// Offline Mode (docs/specs/006-design/offline-mode.md): designs saved only in THIS browser, in IndexedDB,
// never to the API. This module is the local counterpart of `lib/api/*`, it
// produces the same wire shapes (LiveDoc / DesignSummary / Tab) so the editor
// and Explorer render an offline design exactly like a cloud one; the
// persistence dispatch in `lib/api/*` routes to these when a design id is
// registered offline (see `isOfflineId`).
//
// Storage: one IndexedDB record per design, holding its meta + all tab bodies
// inline (offline designs load whole, no lazy per-tab fetch). The set of
// offline ids IS the set of record keys, mirrored in an in-memory cache so the
// dispatch can answer "is this id offline?" cheaply (./offline-ids, which keeps
// every tab of the browser in step).

import type { LiveDoc, DesignSummary, RecordedIntent, TabSummary } from '@livedesign/api-schema';
import { utcDay } from '@livedesign/api-schema';
import { drawnCount, migrateStoredTab, stampTabKind } from '@livedesign/design';
import type { DesignComponent, Tab } from '@livedesign/design';
import { DesignTrashedError } from '../design-trashed';
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
import { offlineDesignStats } from './offline-stats';
import { noteThisBrowser } from './this-browser';
import {
  applyMeta as applyMetaShared,
  createOfflineStore,
  removeTab as removeTabShared,
  tabToSummaryFor,
  upsertTabWith,
  type OfflineDeleteOutcome,
} from '@liveworkspace/workbench/lib/offline/offline-store-core';

// Sentinel owner id stamped on offline designs. They have no server owner;
// this keeps the wire shape valid and is never sent anywhere.
export const OFFLINE_OWNER_ID = 'offline';

// The stored shape for one offline design.
export type OfflineDesignRecord = {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: number;
  savedAt: number;
  tabs: Tab[];
  // A record written before 25 October 2026 may still carry the slide deck it had (`presentation`):
  // nothing reads it (docs/specs/012-collaboration/presentation-mode.md "Saved data").
  // Starred in the Explorer (docs/specs/013-workspace/favourites.md). Cloud stars are liveworkspace's index's,
  // on an item an offline design does not have, so its star has to live here instead. Optional so records
  // written before the field existed stay valid.
  favourite?: boolean;
  // When the design was moved to this browser's local Trash
  // (docs/specs/013-workspace/trash.md). Absent = live.
  // A trashed record keeps everything else so a restore is exact.
  trashedAt?: number;
  // This Browser's opens of the design (docs/specs/013-workspace/explorer-home.md "Opens"),
  // for Home's Recent; see ./offline-opens.ts. Optional: a record never opened has none.
  opens?: StoredLocalOpens;
  // The design's component library (docs/specs/009-elements/components.md "This Browser"). Optional: a record
  // written before components, or a design with none, has none.
  components?: DesignComponent[];
};

// A local design's opens, counted like the server's (docs/specs/013-workspace/explorer-home.md
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
  designId: string,
  orderIndex: number,
  at: number,
) => TabSummary = tabToSummaryFor('designId');

// No creation intent is recorded in the browser: unknown, never Diagram
// (docs/specs/013-workspace/default-folders.md "Recorded intent").
const UNKNOWN_INTENT: RecordedIntent = { opensIn: null, tabKind: null };

// Project a stored record into the full `LiveDoc` the editor hydrates from.
// The server-only fields take their inert defaults (unshared, no team, no
// provenance, no owner join), offline designs are private by construction.
export function recordToDesign(rec: OfflineDesignRecord): LiveDoc {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    tabs: rec.tabs.map((t, i) => tabToSummary(t, rec.id, i, rec.savedAt)),
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
export function recordToSummary(rec: OfflineDesignRecord): DesignSummary {
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
    stats: offlineDesignStats(rec),
  };
}

// Apply a design-meta change (rename + tab order/folder) to a record,
// returning a new record. Mirrors `apiSaveDesignMeta`: `tabs` (when given)
// reorders the existing tab bodies by id and refreshes each tab's folder.
export function applyMeta(
  rec: OfflineDesignRecord,
  patch: {
    name?: string;
    tabs?: { id: string; folder?: string }[];
  },
  at: number,
): OfflineDesignRecord {
  return applyMetaShared(rec, patch, at);
}

// Upsert one tab body into a record (the autosave path). A new tab id is
// appended; an existing one is replaced in place, preserving order.
export function upsertTab(rec: OfflineDesignRecord, tab: Tab, at: number): OfflineDesignRecord {
  return upsertTabWith(rec, tab, at, stampTabKind);
}

export function removeTab(
  rec: OfflineDesignRecord,
  tabId: string,
  at: number,
): OfflineDesignRecord {
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
// autosave shows the failure instead of "Saved" and its retry routes where the design now is.
export class OfflineDesignMissingError extends Error {
  constructor(id: string) {
    super(`offline design ${id} is no longer in this browser`);
    this.name = 'OfflineDesignMissingError';
  }
}

// ---------------------------------------------------------------------------
// Public operations, the local mirror of the design/tab api surface
// ---------------------------------------------------------------------------

// The shared operations (@liveworkspace/workbench/lib/offline/offline-store-core): one write chain serialises every
// read-modify-write op in this browser tab, each one IndexedDB transaction.
const store = createOfflineStore<
  Tab,
  OfflineDesignRecord,
  ReturnType<typeof recordToDesign>,
  ReturnType<typeof recordToSummary>
>({
  // Read at call time, as the operations always did (the offline modules import each other).
  backend: () => offlineBackend(),
  rememberId: (id) => rememberOfflineId(id),
  forgetId: (id) => forgetOfflineId(id),
  isOfflineIdSync: (id) => isOfflineIdSync(id),
  noteThisBrowser: (id, after) => noteThisBrowser(id, after),
  toItem: recordToDesign,
  toSummary: recordToSummary,
  migrateTab: (tab) => migrateStoredTab(tab),
  trashedError: (id) => new DesignTrashedError(id),
  missingError: (id) => new OfflineDesignMissingError(id),
});

export const serializeOfflineWrite = store.serializeOfflineWrite;

// Read-modify-write one record in a single transaction. Callers run it inside serializeOfflineWrite.
export const offlineUpdateRecord: (id: string, change: OfflineRecordChange) => Promise<void> =
  store.offlineUpdateRecord;

// The editor's writes to a live record: a no-op once this tab forgot the id, OfflineDesignMissingError while it
// still lists it.
const writeLive = store.writeLive;

// The design's component library, archived mains included; [] for a record with none or no record.
export async function offlineLoadComponents(id: string): Promise<DesignComponent[]> {
  const rec = await offlineBackend().get(id);
  return rec?.components ?? [];
}

// Makes or replaces one main in the record's library.
export async function offlineSaveComponent(id: string, component: DesignComponent): Promise<void> {
  // savedAt moves like any edit's, so a sync running meanwhile uploads again (offline-sync.ts uploadMark).
  await writeLive(id, (rec) => ({
    ...rec,
    savedAt: Date.now(),
    components: [...(rec.components ?? []).filter((c) => c.id !== component.id), component],
  }));
}

// Live records only: a trashed one waits in the local Trash.
export const offlineListDesigns = store.listItems;

// A trashed record reads as the deleted state, the local twin of the api's 410.
export const offlineLoadDesign = store.loadItem;

export const offlineLoadTab = store.loadTab;

// `extra`: a design's own created and last-modified dates (docs/specs/015-api/api.md "Design
// dates"), absent now; the personal folder it is filed in. Making a design here is a use of it: its
// record of uses starts with the day and the moment it was made, as a first open would
// (docs/specs/013-workspace/explorer-home.md "Making a design"; offline-opens.ts).
export async function offlineCreateDesign(
  d: { id: string; name: string; tabs?: Tab[] },
  now: number,
  extra: {
    createdAt?: number;
    savedAt?: number;
    folderId?: string | null;
  } = {},
): Promise<LiveDoc> {
  const rec: OfflineDesignRecord = {
    id: d.id,
    name: d.name,
    folderId: extra.folderId ?? null,
    createdAt: extra.createdAt ?? now,
    savedAt: extra.savedAt ?? now,
    tabs: d.tabs ?? [],
    opens: { days: [utcDay(now)], lastOpenedAt: now },
  };
  return store.createRecord(rec);
}

export async function offlineSaveDesignMeta(
  id: string,
  patch: { name?: string; tabs?: { id: string; folder?: string }[] },
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => applyMeta(rec, patch, now));
}

// Personal-folder placement for an offline design (docs/specs/013-workspace/folders.md). Folders are
// server-side rows, but an offline record carries a folderId so its row can
// sit in the Explorer's personal tree like any other.
export async function offlineSetDesignFolder(
  id: string,
  folderId: string | null,
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => ({ ...rec, folderId, savedAt: now }));
}

// Star / un-star an offline design (docs/specs/013-workspace/favourites.md). The savedAt stamp is left
// alone on purpose: a star is a per-user bookmark, not an edit to the
// design, and bumping it would reorder Recent on a click that changed
// nothing about the content.
export const offlineSetFavourite = store.setFavourite;

export const offlineListFavouriteIds = store.listFavouriteIds;

export async function offlineSaveTab(id: string, tab: Tab, now: number): Promise<void> {
  // No create-on-missing: a save must never resurrect a deleted design.
  // A pending debounced autosave can land AFTER a sync-to-cloud deleted
  // the record; recreating it here would shadow the freshly-synced cloud
  // copy behind a 1-tab offline ghost (the local analog of the server's
  // old create-on-first-write bug). Records are only ever created by
  // offlineCreateDesign / offlinePutRecord.
  await writeLive(id, (rec) => upsertTab(rec, tab, now));
}

export const offlineDeleteTab = store.deleteTab;

export const offlineDeleteDesign = store.deleteItem;

// Sync Design's last step (docs/specs/006-design/offline-mode.md "Save to server"): remove the
// record only if it still matches what was uploaded, judged and done in one transaction so no write
// (from this tab or another) can land between the check and the delete. Answers what it found:
// `deleted` (with the record as it was), `changed` (with the record as it is now) or `missing`.
export const offlineDeleteIfUnchanged: (
  id: string,
  unchanged: (rec: OfflineDesignRecord) => boolean,
) => Promise<OfflineDeleteOutcome<OfflineDesignRecord>> = store.offlineDeleteIfUnchanged;

// Read the raw record, used by the Offline → Cloud conversion (docs/specs/006-design/offline-mode.md) to
// upload the whole design, and by "take offline" to seed one.
export const offlineGetRecord = store.offlineGetRecord;

export const offlinePutRecord = store.offlinePutRecord;
