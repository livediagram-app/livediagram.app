// Offline Mode's storage backend (docs/specs/006-document/offline-mode.md): one IndexedDB object
// store of document records, behind a small interface so tests swap in an in-memory map. The
// record shape and every operation on it live in ./offline-store.ts.

import { upgradeStores } from './legacy-offline-store';
import { INDEXED_DB_PROBE_TIMEOUT_MS } from '@livediagram/ui';
import type { OfflineDocumentRecord } from './offline-store';

const DB_NAME = 'livediagram-offline';
// Version 2 renamed the object store (docs/specs/006-document/offline-mode.md);
// ./legacy-offline-store moves every record across.
const DB_VERSION = 2;
const STORE = 'documents';

// What a read-modify-write gets: the stored record (undefined when there is none), and what it
// answers: the record to store, 'delete' to remove it, or undefined to write nothing. Synchronous, because IndexedDB
// commits a transaction the moment it is left with no pending request; a throw writes nothing
// and rejects the update with the thrown error.
export type OfflineRecordChange = (
  rec: OfflineDocumentRecord | undefined,
) => OfflineDocumentRecord | 'delete' | undefined;

export type OfflineBackend = {
  get(id: string): Promise<OfflineDocumentRecord | undefined>;
  put(rec: OfflineDocumentRecord): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<OfflineDocumentRecord[]>;
  // The read and the write in ONE transaction, so another browser tab's write cannot land between
  // them and be overwritten (two transactions let it: the module's write chain only orders this tab).
  update(id: string, change: OfflineRecordChange): Promise<void>;
};

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

// How long opening the store may take (docs/specs/007-editor/load-recovery.md "The load always ends").
// Every document load asks the store first, so a browser whose IndexedDB never answers `open` used to
// hold the load on the opening screen forever. Shared with the browser checks' probe so the
// diagnostics report the same limit the load uses.
export const OFFLINE_STORE_OPEN_TIMEOUT_MS = INDEXED_DB_PROBE_TIMEOUT_MS;

// Thrown when the store did not open in time or reported `blocked`.
export class OfflineStoreUnavailableError extends Error {
  constructor(reason: 'timeout' | 'blocked') {
    super(`offline store ${reason}`);
    this.name = 'OfflineStoreUnavailableError';
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let settled = false;
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    const giveUp = (reason: 'timeout' | 'blocked') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new OfflineStoreUnavailableError(reason));
    };
    const timer = setTimeout(() => giveUp('timeout'), OFFLINE_STORE_OPEN_TIMEOUT_MS);
    req.onupgradeneeded = () => upgradeStores(req.result, req.transaction!, STORE);
    req.onblocked = () => giveUp('blocked');
    req.onsuccess = () => {
      // An open that lands after we gave up is closed at once, so it never holds a version lock.
      if (settled) return req.result.close();
      settled = true;
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
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

// The get and the put share one readwrite transaction; it settles when the transaction commits,
// so a resolved update is on disk.
async function idbUpdate(id: string, change: OfflineRecordChange): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let thrown: { err: unknown } | null = null;
      const read = store.get(id) as IDBRequest<OfflineDocumentRecord | undefined>;
      read.onsuccess = () => {
        try {
          const next = change(read.result);
          if (next === 'delete') store.delete(id);
          else if (next) store.put(next);
        } catch (err) {
          thrown = { err };
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(thrown ? thrown.err : (tx.error ?? new Error('IndexedDB update aborted')));
    });
  } finally {
    db.close();
  }
}

const indexedDbBackend: OfflineBackend = {
  get: (id) => run('readonly', (s) => s.get(id) as IDBRequest<OfflineDocumentRecord | undefined>),
  put: (rec) => run('readwrite', (s) => s.put(rec)).then(() => undefined),
  delete: (id) => run('readwrite', (s) => s.delete(id)).then(() => undefined),
  all: () => run('readonly', (s) => s.getAll() as IDBRequest<OfflineDocumentRecord[]>),
  update: idbUpdate,
};

let backend: OfflineBackend = indexedDbBackend;

// The current backend, for the offline modules, which read and rewrite whole records.
export function offlineBackend(): OfflineBackend {
  return backend;
}

// Test seam behind ./offline-store's __setOfflineBackend, which also resets the id cache.
export function setOfflineBackend(b: OfflineBackend | null): void {
  backend = b ?? indexedDbBackend;
}
