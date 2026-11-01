// Test helpers for the offline database as a browser would hold it (fake-indexeddb): a database seeded at an old
// version the way the old editor left it, and raw reads that go round the editor's own open (and its upgrade).

export const OFFLINE_DB = 'livehuddle-offline';

export function deleteOfflineDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(OFFLINE_DB);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete failed'));
  });
}

// A database at `version` holding `records` in `store` (`diagrams` at version 1, `documents` at 2).
export function seedOfflineDb(version: number, store: string, records: object[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, version);
    req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'id' });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(store, 'readwrite');
      for (const r of records) tx.objectStore(store).put(r);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error('seed failed'));
    };
    req.onerror = () => reject(req.error ?? new Error('open failed'));
  });
}

// Opens whatever version is there, without upgrading it.
function openCurrent(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('open failed'));
  });
}

export async function offlineDbShape(): Promise<{ version: number; stores: string[] }> {
  const db = await openCurrent();
  const shape = { version: db.version, stores: [...db.objectStoreNames] };
  db.close();
  return shape;
}

export async function readStoreRaw(store: string): Promise<unknown[]> {
  const db = await openCurrent();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('read failed'));
    });
  } finally {
    db.close();
  }
}

// A connection held open at `version`, as another browser tab on older code would hold one.
export function holdOpen(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('open failed'));
  });
}
