// Offline documents were kept in the `diagrams` object store before the container became a
// document (docs/specs/006-document/offline-mode.md). Version 2 of the database moves every
// record into the current store. Version 3 adds the `retired-parts` store and sets aside every record holding
// content livediagram no longer reads (./retired-parts-upgrade). Runs inside the version-change transaction, so a
// reader never sees a half-moved store, nor a record before it was set aside.

import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { createSetAside, ensureRetiredPartsStore } from './retired-parts-upgrade';
const LEGACY_STORE = 'diagrams';

export function upgradeStores(
  db: IDBDatabase,
  tx: IDBTransaction,
  store: string,
  // The version the database had: 0 when it did not exist.
  oldVersion = 0,
): void {
  if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
  ensureRetiredPartsStore(db);
  // Only an upgrade from before version 3 has anything to set aside; a new database has no records.
  const setAside = oldVersion > 0 && oldVersion < 3 ? createSetAside(tx) : null;
  if (!db.objectStoreNames.contains(LEGACY_STORE)) {
    // Version 2, from either editor: every record already in the current store.
    setAside?.scan(tx.objectStore(store));
    return;
  }
  const from = tx.objectStore(LEGACY_STORE);
  const to = tx.objectStore(store);
  let moved = 0;
  from.openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
    if (cursor) {
      to.put(cursor.value);
      // Version 1: each record is checked as it moves, so none is read before it is set aside.
      setAside?.consider(cursor.value);
      moved++;
      cursor.continue();
      return;
    }
    db.deleteObjectStore(LEGACY_STORE);
    debugLog('[offline-store] moved', moved, 'offline documents to the', store, 'store');
    setAside?.report();
  };
}
