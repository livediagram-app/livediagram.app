// Offline Mode (spec/76): diagrams saved only in THIS browser, in IndexedDB,
// never to the API. This module is the local counterpart of `lib/api/*` — it
// produces the same wire shapes (Diagram / DiagramSummary / Tab) so the editor
// and Explorer render an offline diagram exactly like a cloud one; the
// persistence dispatch in `lib/api/*` routes to these when a diagram id is
// registered offline (see `isOfflineId`).
//
// Storage: one IndexedDB record per diagram, holding its meta + all tab bodies
// inline (offline diagrams load whole — no lazy per-tab fetch). The set of
// offline ids IS the set of record keys, mirrored in an in-memory cache so the
// dispatch can answer "is this id offline?" cheaply.

import type { Diagram, DiagramSummary, TabSummary } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/diagram';

// Sentinel owner id stamped on offline diagrams. They have no server owner;
// this keeps the wire shape valid and is never sent anywhere.
export const OFFLINE_OWNER_ID = 'offline';

const DB_NAME = 'livediagram-offline';
const DB_VERSION = 1;
const STORE = 'diagrams';

// The stored shape for one offline diagram.
export type OfflineDiagramRecord = {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: number;
  savedAt: number;
  tabs: Tab[];
};

// ---------------------------------------------------------------------------
// Pure transforms (unit-tested — no IndexedDB involved)
// ---------------------------------------------------------------------------

export function tabToSummary(
  tab: Tab,
  diagramId: string,
  orderIndex: number,
  at: number,
): TabSummary {
  const summary: TabSummary = {
    id: tab.id,
    diagramId,
    name: tab.name,
    orderIndex,
    updatedAt: at,
  };
  if (tab.folder !== undefined) summary.folder = tab.folder;
  return summary;
}

// Project a stored record into the full `Diagram` the editor hydrates from.
// The server-only fields take their inert defaults (unshared, no team, no
// provenance, no owner join) — offline diagrams are private by construction.
export function recordToDiagram(rec: OfflineDiagramRecord): Diagram {
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
  };
}

// Project a record into a list row (drops tab bodies).
export function recordToSummary(rec: OfflineDiagramRecord): DiagramSummary {
  return {
    id: rec.id,
    ownerId: OFFLINE_OWNER_ID,
    name: rec.name,
    shareable: false,
    shareCode: null,
    folderId: rec.folderId,
    teamId: null,
    source: null,
    savedAt: rec.savedAt,
    createdAt: rec.createdAt,
  };
}

// Apply a diagram-meta change (rename + tab order/folder) to a record,
// returning a new record. Mirrors `apiSaveDiagramMeta`: `tabs` (when given)
// reorders the existing tab bodies by id and refreshes each tab's folder.
export function applyMeta(
  rec: OfflineDiagramRecord,
  patch: { name?: string; tabs?: { id: string; folder?: string }[] },
  at: number,
): OfflineDiagramRecord {
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
  return { ...rec, name: patch.name ?? rec.name, tabs, savedAt: at };
}

// Upsert one tab body into a record (the autosave path). A new tab id is
// appended; an existing one is replaced in place, preserving order.
export function upsertTab(rec: OfflineDiagramRecord, tab: Tab, at: number): OfflineDiagramRecord {
  const i = rec.tabs.findIndex((t) => t.id === tab.id);
  const tabs = i === -1 ? [...rec.tabs, tab] : rec.tabs.map((t) => (t.id === tab.id ? tab : t));
  return { ...rec, tabs, savedAt: at };
}

export function removeTab(
  rec: OfflineDiagramRecord,
  tabId: string,
  at: number,
): OfflineDiagramRecord {
  return { ...rec, tabs: rec.tabs.filter((t) => t.id !== tabId), savedAt: at };
}

// ---------------------------------------------------------------------------
// Storage backend (IndexedDB by default; swappable in tests)
// ---------------------------------------------------------------------------

export type OfflineBackend = {
  get(id: string): Promise<OfflineDiagramRecord | undefined>;
  put(rec: OfflineDiagramRecord): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<OfflineDiagramRecord[]>;
};

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const store = db.transaction(STORE, mode).objectStore(STORE);
    return await idbRequest(op(store));
  } finally {
    db.close();
  }
}

const indexedDbBackend: OfflineBackend = {
  get: (id) => run('readonly', (s) => s.get(id) as IDBRequest<OfflineDiagramRecord | undefined>),
  put: (rec) => run('readwrite', (s) => s.put(rec)).then(() => undefined),
  delete: (id) => run('readwrite', (s) => s.delete(id)).then(() => undefined),
  all: () => run('readonly', (s) => s.getAll() as IDBRequest<OfflineDiagramRecord[]>),
};

let backend: OfflineBackend = indexedDbBackend;

// Test seam: swap in an in-memory backend. Also resets the id cache.
export function __setOfflineBackend(b: OfflineBackend | null): void {
  backend = b ?? indexedDbBackend;
  idCache = null;
  idCacheLoad = null;
}

// ---------------------------------------------------------------------------
// Offline id cache — cheap "is this diagram offline?" for the dispatch
// ---------------------------------------------------------------------------

let idCache: Set<string> | null = null;
let idCacheLoad: Promise<Set<string>> | null = null;

async function loadIds(): Promise<Set<string>> {
  if (idCache) return idCache;
  if (!idCacheLoad) {
    idCacheLoad = backend
      .all()
      .then((recs) => {
        idCache = new Set(recs.map((r) => r.id));
        return idCache;
      })
      .catch(() => {
        // No IndexedDB (SSR, private mode) → treat as no offline diagrams.
        idCache = new Set();
        return idCache;
      });
  }
  return idCacheLoad;
}

export async function isOfflineId(id: string): Promise<boolean> {
  return (await loadIds()).has(id);
}

export async function listOfflineIds(): Promise<string[]> {
  return [...(await loadIds())];
}

function rememberId(id: string): void {
  if (idCache) idCache.add(id);
}
function forgetId(id: string): void {
  if (idCache) idCache.delete(id);
}

// ---------------------------------------------------------------------------
// Public operations — the local mirror of the diagram/tab api surface
// ---------------------------------------------------------------------------

export async function offlineListDiagrams(): Promise<DiagramSummary[]> {
  const recs = await backend.all();
  return recs.map(recordToSummary);
}

export async function offlineLoadDiagram(id: string): Promise<Diagram | null> {
  const rec = await backend.get(id);
  return rec ? recordToDiagram(rec) : null;
}

export async function offlineLoadTab(id: string, tabId: string): Promise<Tab | null> {
  const rec = await backend.get(id);
  return rec?.tabs.find((t) => t.id === tabId) ?? null;
}

export async function offlineCreateDiagram(
  d: { id: string; name: string; tabs?: Tab[] },
  now: number,
): Promise<Diagram> {
  const rec: OfflineDiagramRecord = {
    id: d.id,
    name: d.name,
    folderId: null,
    createdAt: now,
    savedAt: now,
    tabs: d.tabs ?? [],
  };
  await backend.put(rec);
  rememberId(rec.id);
  return recordToDiagram(rec);
}

export async function offlineSaveDiagramMeta(
  id: string,
  patch: { name?: string; tabs?: { id: string; folder?: string }[] },
  now: number,
): Promise<void> {
  const rec = await backend.get(id);
  if (!rec) return;
  await backend.put(applyMeta(rec, patch, now));
}

export async function offlineSaveTab(id: string, tab: Tab, now: number): Promise<void> {
  const rec = (await backend.get(id)) ?? {
    id,
    name: 'Untitled',
    folderId: null,
    createdAt: now,
    savedAt: now,
    tabs: [],
  };
  await backend.put(upsertTab(rec, tab, now));
  rememberId(id);
}

export async function offlineDeleteTab(id: string, tabId: string, now: number): Promise<void> {
  const rec = await backend.get(id);
  if (!rec) return;
  await backend.put(removeTab(rec, tabId, now));
}

export async function offlineDeleteDiagram(id: string): Promise<void> {
  await backend.delete(id);
  forgetId(id);
}

// Read the raw record — used by the Offline → Cloud conversion (spec/76) to
// upload the whole diagram, and by "take offline" to seed one.
export async function offlineGetRecord(id: string): Promise<OfflineDiagramRecord | null> {
  return (await backend.get(id)) ?? null;
}

export async function offlinePutRecord(rec: OfflineDiagramRecord): Promise<void> {
  await backend.put(rec);
  rememberId(rec.id);
}
