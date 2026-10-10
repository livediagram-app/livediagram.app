// Offline Mode (docs/specs/006-document/offline-mode.md): documents saved only in THIS browser, in IndexedDB,
// never to the API. This module is the local counterpart of `lib/api/*` — it
// produces the same wire shapes (LiveDoc / DocumentSummary / Tab) so the editor
// and Explorer render an offline document exactly like a cloud one; the
// persistence dispatch in `lib/api/*` routes to these when a document id is
// registered offline (see `isOfflineId`).
//
// Storage: one IndexedDB record per document, holding its meta + all tab bodies
// inline (offline documents load whole — no lazy per-tab fetch). The set of
// offline ids IS the set of record keys, mirrored in an in-memory cache so the
// dispatch can answer "is this id offline?" cheaply (./offline-ids, which keeps
// every tab of the browser in step).

import type { SheetJson } from '@livediagram/sheets';
import type { LiveDoc, DocumentSummary, RecordedIntent, TabSummary } from '@livediagram/api-schema';
import { utcDay } from '@livediagram/api-schema';
import { migrateStoredTab, stampTabKind } from '@livediagram/document';
import type { Tab } from '@livediagram/document';
import { readItemTypeCatalogue, type Item, type ItemTypeCatalogue } from '@livediagram/items';
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
  // Starred in the Explorer (docs/specs/013-workspace/favourites.md). Cloud stars live in a D1 table whose
  // document_id is a foreign key into `documents`, which an offline document has
  // no row in, so its star has to live here instead. Optional so records
  // written before the field existed stay valid.
  favourite?: boolean;
  // When the document was moved to this browser's local Trash
  // (docs/specs/013-workspace/trash.md, see ./offline-trash.ts). Absent = live.
  // A trashed record keeps everything else so a restore is exact.
  trashedAt?: number;
  // This browser's opens of the document (docs/specs/013-workspace/explorer-home.md "Opens"),
  // for Home's Jump back in; see ./offline-opens.ts. Optional: a record never opened has none.
  opens?: StoredLocalOpens;
  // The document's item store (docs/specs/026-plan/items.md "Offline documents"): its items, the
  // store's revision and the next item key. Optional: a record without them has an empty store.
  items?: Item[];
  itemsRev?: number;
  itemsNextKey?: number;
  // The type catalogue (docs/specs/026-plan/item-types.md), absent or null for the default types.
  itemTypes?: ItemTypeCatalogue | null;
  // The document's sheet store (docs/specs/029-sheets/sheet-store.md "Offline documents"): every sheet, cells
  // included. Optional: a record without it has none.
  sheets?: SheetJson[];
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
// Pure transforms (unit-tested — no IndexedDB involved)
// ---------------------------------------------------------------------------

export function tabToSummary(
  tab: Tab,
  documentId: string,
  orderIndex: number,
  at: number,
): TabSummary {
  const summary: TabSummary = {
    id: tab.id,
    documentId,
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

// Project a stored record into the full `LiveDoc` the editor hydrates from.
// The server-only fields take their inert defaults (unshared, no team, no
// provenance, no owner join) — offline documents are private by construction.
export function recordToDocument(rec: OfflineDocumentRecord): LiveDoc {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    tabs: rec.tabs.map((t, i) => tabToSummary(t, rec.id, i, rec.savedAt)),
    presentation: rec.presentation ?? null,
    itemTypes: readItemTypeCatalogue(rec.itemTypes ?? null),
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
    empty: (rec.tabs[0]?.elements.length ?? 0) === 0,
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
    ...(patch.presentation !== undefined ? { presentation: patch.presentation } : {}),
    savedAt: at,
  };
}

// Upsert one tab body into a record (the autosave path). A new tab id is
// appended; an existing one is replaced in place, preserving order.
export function upsertTab(rec: OfflineDocumentRecord, tab: Tab, at: number): OfflineDocumentRecord {
  // Stamp the tab kind here for the same reason the cloud path stamps it
  // in tabForWire (docs/specs/021-event-storming/event-storming.md): both stores must agree on what a tab IS, or a
  // Sync Document would hand the cloud a board that has forgotten itself.
  const stamped = stampTabKind(tab);
  const i = rec.tabs.findIndex((t) => t.id === stamped.id);
  const tabs =
    i === -1 ? [...rec.tabs, stamped] : rec.tabs.map((t) => (t.id === stamped.id ? stamped : t));
  return { ...rec, tabs, savedAt: at };
}

export function removeTab(
  rec: OfflineDocumentRecord,
  tabId: string,
  at: number,
): OfflineDocumentRecord {
  return { ...rec, tabs: rec.tabs.filter((t) => t.id !== tabId), savedAt: at };
}

// ---------------------------------------------------------------------------
// Storage backend (./offline-backend) and the id cache (./offline-ids)
// ---------------------------------------------------------------------------

export {
  OFFLINE_STORE_OPEN_TIMEOUT_MS,
  OfflineStoreUnavailableError,
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
// Public operations — the local mirror of the document/tab api surface
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
// (an editor left open on a binned document must not keep changing it).
function writable(rec: OfflineDocumentRecord | undefined): rec is OfflineDocumentRecord {
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
  return offlineBackend().update(id, change);
}

// The editor's writes to a live record: `change` runs on it when it is writable. A missing record
// is a no-op when this tab has already forgotten the id (a queued autosave landing after this
// tab's own Sync Document), and an OfflineDocumentMissingError when the id is still listed.
async function writeLive(
  id: string,
  change: (rec: OfflineDocumentRecord) => OfflineDocumentRecord,
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
      throw new OfflineDocumentMissingError(id);
    }
  });
}

// Live records only: a trashed one waits in the local Trash.
export async function offlineListDocuments(): Promise<DocumentSummary[]> {
  const recs = await offlineBackend().all();
  return recs.filter((r) => r.trashedAt === undefined).map(recordToSummary);
}

// A trashed record reads as the deleted state, the local twin of the api's 410.
export async function offlineLoadDocument(id: string): Promise<LiveDoc | null> {
  const rec = await offlineBackend().get(id);
  if (rec?.trashedAt !== undefined) throw new DocumentTrashedError(id);
  return rec ? recordToDocument(rec) : null;
}

export async function offlineLoadTab(id: string, tabId: string): Promise<Tab | null> {
  const rec = await offlineBackend().get(id);
  const tab = rec?.tabs.find((t) => t.id === tabId) ?? null;
  // The offline twin of the api's rowToTab: a document kept in this browser can
  // still be on a retired scheme (docs/specs/011-theme/retired-schemes.md) or carry retired element fields.
  return tab ? migrateStoredTab(tab) : null;
}

// `extra`: a document's own created and last-modified dates (an imported board,
// docs/specs/015-api/api.md "Document dates"), absent now; the personal folder it is filed in.
// Making a document here is a use of it, unless it came in a bulk import (`markUsed: false`): its
// record of uses starts with the day and the moment it was made, as a first open would
// (docs/specs/013-workspace/explorer-home.md "Making a document"; offline-opens.ts).
export async function offlineCreateDocument(
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
    ...(d.itemTypes ? { itemTypes: d.itemTypes } : {}),
    ...(d.sheets?.length ? { sheets: d.sheets } : {}),
    ...(extra.markUsed === false ? {} : { opens: { days: [utcDay(now)], lastOpenedAt: now } }),
  };
  await offlineBackend().put(rec);
  rememberOfflineId(rec.id);
  return recordToDocument(rec);
}

export async function offlineSaveDocumentMeta(
  id: string,
  patch: { name?: string; tabs?: { id: string; folder?: string }[]; presentation?: string | null },
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => applyMeta(rec, patch, now));
}

// An offline document's type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"), already
// validated by the caller; null goes back to the default types.
export async function offlineSaveItemTypes(
  id: string,
  itemTypes: ItemTypeCatalogue | null,
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => ({ ...rec, itemTypes, savedAt: now }));
}

// Personal-folder placement for an offline document (docs/specs/013-workspace/folders.md). Folders are
// server-side rows, but an offline record carries a folderId so its row can
// sit in the Explorer's personal tree like any other.
export async function offlineSetDocumentFolder(
  id: string,
  folderId: string | null,
  now: number,
): Promise<void> {
  await writeLive(id, (rec) => ({ ...rec, folderId, savedAt: now }));
}

// Star / un-star an offline document (docs/specs/013-workspace/favourites.md). The savedAt stamp is left
// alone on purpose: a star is a per-user bookmark, not an edit to the
// document, and bumping it would reorder Recent on a click that changed
// nothing about the content.
export async function offlineSetFavourite(id: string, favourite: boolean): Promise<void> {
  await serializeOfflineWrite(() =>
    offlineUpdateRecord(id, (rec) => (rec ? { ...rec, favourite } : undefined)),
  );
}

export async function offlineListFavouriteIds(): Promise<string[]> {
  const recs = await offlineBackend().all();
  return recs.filter((r) => r.favourite && r.trashedAt === undefined).map((r) => r.id);
}

export async function offlineSaveTab(id: string, tab: Tab, now: number): Promise<void> {
  // No create-on-missing: a save must never resurrect a deleted document.
  // A pending debounced autosave can land AFTER a sync-to-cloud deleted
  // the record; recreating it here would shadow the freshly-synced cloud
  // copy behind a 1-tab offline ghost (the local analog of the server's
  // old create-on-first-write bug). Records are only ever created by
  // offlineCreateDocument / offlinePutRecord.
  await writeLive(id, (rec) => upsertTab(rec, tab, now));
}

export async function offlineDeleteTab(id: string, tabId: string, now: number): Promise<void> {
  await writeLive(id, (rec) => removeTab(rec, tabId, now));
}

export async function offlineDeleteDocument(id: string): Promise<void> {
  // Serialized with the tab / meta writes so a queued save can't interleave
  // with (or observe a half-applied) delete.
  await serializeOfflineWrite(async () => {
    await offlineBackend().delete(id);
    forgetOfflineId(id);
  });
}

// Sync Document's last step (docs/specs/006-document/offline-mode.md "Save to server"): remove the
// record only if it still matches what was uploaded, judged and done in one transaction so no write
// (from this tab or another) can land between the check and the delete. Answers what it found:
// `deleted` (with the record as it was), `changed` (with the record as it is now) or `missing`.
export type OfflineDeleteOutcome =
  { outcome: 'deleted' | 'changed'; rec: OfflineDocumentRecord } | { outcome: 'missing' };

export async function offlineDeleteIfUnchanged(
  id: string,
  unchanged: (rec: OfflineDocumentRecord) => boolean,
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

// Read the raw record — used by the Offline → Cloud conversion (docs/specs/006-document/offline-mode.md) to
// upload the whole document, and by "take offline" to seed one.
export async function offlineGetRecord(id: string): Promise<OfflineDocumentRecord | null> {
  return (await offlineBackend().get(id)) ?? null;
}

export async function offlinePutRecord(rec: OfflineDocumentRecord): Promise<void> {
  await offlineBackend().put(rec);
  rememberOfflineId(rec.id);
}
