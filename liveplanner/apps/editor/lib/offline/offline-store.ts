// Offline Mode (docs/specs/006-project/offline-mode.md): projects saved only in THIS browser, in IndexedDB,
// never to the API. This module is the local counterpart of `lib/api/*` — it
// produces the same wire shapes (Project / ProjectSummary / Tab) so the editor
// and Explorer render an offline project exactly like a cloud one; the
// persistence dispatch in `lib/api/*` routes to these when a project id is
// registered offline (see `isOfflineId`).
//
// Storage: one IndexedDB record per project, holding its meta + all tab bodies
// inline (offline projects load whole — no lazy per-tab fetch). The set of
// offline ids IS the set of record keys, mirrored in an in-memory cache so the
// dispatch can answer "is this id offline?" cheaply (./offline-ids, which keeps
// every tab of the browser in step).

import type { SheetJson } from '@liveplanner/sheets';
import type { Project, ProjectSummary, RecordedIntent, TabSummary } from '@liveplanner/api-schema';
import { utcDay } from '@liveplanner/api-schema';
import { drawnCount, migrateStoredTab, stampTabKind } from '@liveplanner/project';
import type { Tab } from '@liveplanner/project';
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
  // for Home's Jump Back In; see ./offline-opens.ts. Optional: a record never opened has none.
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
// Pure transforms (unit-tested — no IndexedDB involved)
// ---------------------------------------------------------------------------

export function tabToSummary(
  tab: Tab,
  projectId: string,
  orderIndex: number,
  at: number,
): TabSummary {
  const summary: TabSummary = {
    id: tab.id,
    projectId,
    name: tab.name,
    orderIndex,
    updatedAt: at,
  };
  if (tab.folder !== undefined) summary.folder = tab.folder;
  return summary;
}

// No creation intent is recorded in the browser: unknown, never Diagram
// (docs/specs/013-workspace/default-folders.md "Recorded intent").
const UNKNOWN_INTENT: RecordedIntent = { opensIn: null, tabKind: null, templateFamily: null };

// Project a stored record into the full `Project` the editor hydrates from.
// The server-only fields take their inert defaults (unshared, no team, no
// provenance, no owner join) — offline projects are private by construction.
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
  let tabs = rec.tabs;
  if (patch.tabs) {
    const byId = new Map(rec.tabs.map((t) => [t.id, t] as const));
    tabs = patch.tabs
      .map((entry) => {
        const tab = byId.get(entry.id);
        if (!tab) return null;
        return entry.folder === (tab.folder ?? undefined) ? tab : { ...tab, folder: entry.folder };
      })
      .filter((t): t is Tab => t !== null);
  }
  return {
    ...rec,
    name: patch.name ?? rec.name,
    tabs,
    savedAt: at,
  };
}

// Upsert one tab body into a record (the autosave path). A new tab id is
// appended; an existing one is replaced in place, preserving order.
export function upsertTab(rec: OfflineProjectRecord, tab: Tab, at: number): OfflineProjectRecord {
  // Stamp the tab kind here for the same reason the cloud path stamps it
  // in tabForWire: both stores must agree on what a tab IS, or a
  // Sync Project would hand the cloud a board that has forgotten itself.
  const stamped = stampTabKind(tab);
  const i = rec.tabs.findIndex((t) => t.id === stamped.id);
  const tabs =
    i === -1 ? [...rec.tabs, stamped] : rec.tabs.map((t) => (t.id === stamped.id ? stamped : t));
  return { ...rec, tabs, savedAt: at };
}

export function removeTab(
  rec: OfflineProjectRecord,
  tabId: string,
  at: number,
): OfflineProjectRecord {
  return { ...rec, tabs: rec.tabs.filter((t) => t.id !== tabId), savedAt: at };
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
// Public operations — the local mirror of the project/tab api surface
// ---------------------------------------------------------------------------

// Every mutation below rewrites the WHOLE record after reading it, so two
// concurrent ops (two tab autosaves, or a tab save racing a rename) could
// each read the same snapshot
// and the later put would silently drop the earlier write. One module-level
// chain serialises all read-modify-write ops in this browser tab; each is one
// IndexedDB transaction, so queueing adds no perceptible latency. The read and
// the write share that transaction (offlineUpdateRecord), which is what keeps
// ANOTHER tab's write from landing between them.
let writeChain: Promise<unknown> = Promise.resolve();

// A record the editor may still write: present, and not in the local Trash
// (an editor left open on a binned project must not keep changing it).
function writable(rec: OfflineProjectRecord | undefined): rec is OfflineProjectRecord {
  return rec !== undefined && rec.trashedAt === undefined;
}
export function serializeOfflineWrite<T>(op: () => Promise<T>): Promise<T> {
  const next = writeChain.then(op, op);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

// Read-modify-write one record in a single transaction (see OfflineRecordChange). Callers run it
// inside serializeOfflineWrite.
export function offlineUpdateRecord(id: string, change: OfflineRecordChange): Promise<void> {
  // What the change left, for This Browser's list (this-browser.ts).
  let after: ReturnType<OfflineRecordChange>;
  return offlineBackend()
    .update(id, (rec) => (after = change(rec)))
    .then(() => noteThisBrowser(id, after));
}

// The editor's writes to a live record: `change` runs on it when it is writable. A missing record
// is a no-op when this tab has already forgotten the id (a queued autosave landing after this
// tab's own Sync Project), and an OfflineProjectMissingError when the id is still listed.
async function writeLive(
  id: string,
  change: (rec: OfflineProjectRecord) => OfflineProjectRecord,
): Promise<void> {
  await serializeOfflineWrite(async () => {
    let missing = false;
    await offlineUpdateRecord(id, (rec) => {
      missing = rec === undefined;
      return writable(rec) ? change(rec) : undefined;
    });
    if (missing && isOfflineIdSync(id)) {
      forgetOfflineId(id);
      console.warn('[offline-store] write-to-missing-record, id forgotten');
      throw new OfflineProjectMissingError(id);
    }
  });
}

// Live records only: a trashed one waits in the local Trash.
export async function offlineListProjects(): Promise<ProjectSummary[]> {
  const recs = await offlineBackend().all();
  return recs.filter((r) => r.trashedAt === undefined).map(recordToSummary);
}

// A trashed record reads as the deleted state, the local twin of the api's 410.
export async function offlineLoadProject(id: string): Promise<Project | null> {
  const rec = await offlineBackend().get(id);
  if (rec?.trashedAt !== undefined) throw new ProjectTrashedError(id);
  return rec ? recordToProject(rec) : null;
}

export async function offlineLoadTab(id: string, tabId: string): Promise<Tab | null> {
  const rec = await offlineBackend().get(id);
  const tab = rec?.tabs.find((t) => t.id === tabId) ?? null;
  // The offline twin of the api's rowToTab: a project kept in this browser can
  // still be on a retired scheme (docs/specs/011-theme/retired-schemes.md) or carry retired element fields.
  return tab ? migrateStoredTab(tab) : null;
}

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
  await offlineBackend().put(rec);
  rememberOfflineId(rec.id);
  noteThisBrowser(rec.id, rec);
  return recordToProject(rec);
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

export async function offlineDeleteTab(id: string, tabId: string, now: number): Promise<void> {
  await writeLive(id, (rec) => removeTab(rec, tabId, now));
}

export async function offlineDeleteProject(id: string): Promise<void> {
  // Serialized with the tab / meta writes so a queued save can't interleave
  // with (or observe a half-applied) delete.
  await serializeOfflineWrite(async () => {
    await offlineBackend().delete(id);
    forgetOfflineId(id);
    noteThisBrowser(id, 'delete');
  });
}

// Sync Project's last step (docs/specs/006-project/offline-mode.md "Save to server"): remove the
// record only if it still matches what was uploaded, judged and done in one transaction so no write
// (from this tab or another) can land between the check and the delete. Answers what it found:
// `deleted` (with the record as it was), `changed` (with the record as it is now) or `missing`.
type OfflineDeleteOutcome =
  { outcome: 'deleted' | 'changed'; rec: OfflineProjectRecord } | { outcome: 'missing' };

export async function offlineDeleteIfUnchanged(
  id: string,
  unchanged: (rec: OfflineProjectRecord) => boolean,
): Promise<OfflineDeleteOutcome> {
  return serializeOfflineWrite(async () => {
    let found = { outcome: 'missing' } as OfflineDeleteOutcome;
    await offlineUpdateRecord(id, (rec) => {
      if (!rec) return undefined;
      const same = unchanged(rec);
      found = { outcome: same ? 'deleted' : 'changed', rec };
      return same ? 'delete' : undefined;
    });
    if (found.outcome !== 'changed') forgetOfflineId(id);
    return found;
  });
}

// Read the raw record — used by the Offline → Cloud conversion (docs/specs/006-project/offline-mode.md) to
// upload the whole project, and by "take offline" to seed one.
export async function offlineGetRecord(id: string): Promise<OfflineProjectRecord | null> {
  return (await offlineBackend().get(id)) ?? null;
}

export async function offlinePutRecord(rec: OfflineProjectRecord): Promise<void> {
  await offlineBackend().put(rec);
  rememberOfflineId(rec.id);
  noteThisBrowser(rec.id, rec);
}
