// Offline documents were kept in the `diagrams` object store before the container became a
// document (docs/specs/006-document/offline-mode.md). Version 2 of the database moves every
// record into the current store. Runs inside the version-change transaction, so a reader
// never sees a half-moved store.

import { debugLog } from '@/lib/debug-log';
const LEGACY_STORE = 'diagrams';

export function upgradeStores(db: IDBDatabase, tx: IDBTransaction, store: string): void {
  if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
  if (!db.objectStoreNames.contains(LEGACY_STORE)) return;
  const from = tx.objectStore(LEGACY_STORE);
  const to = tx.objectStore(store);
  let moved = 0;
  from.openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
    if (cursor) {
      to.put(cursor.value);
      moved++;
      cursor.continue();
      return;
    }
    db.deleteObjectStore(LEGACY_STORE);
    debugLog('[offline-store] moved', moved, 'offline documents to the', store, 'store');
  };
}
