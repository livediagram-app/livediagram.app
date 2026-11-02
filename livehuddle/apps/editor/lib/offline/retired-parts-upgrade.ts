// The set-aside (docs/specs/006-document/offline-mode.md "Retired parts set aside (version 3)"): inside the
// version-change transaction that opens version 3, every document record whose tabs hold Pages or Plan content
// (which this editor drops on read, `migrateStoredTab`) is copied, untouched, into the `retired-parts` store,
// keyed by the document id. Being inside that transaction is what puts it before every read, in any tab.

import { hasRetiredContent } from '@liveworkspace/migration/split';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export const RETIRED_PARTS_STORE = 'retired-parts';

export function ensureRetiredPartsStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(RETIRED_PARTS_STORE)) {
    db.createObjectStore(RETIRED_PARTS_STORE, { keyPath: 'id' });
  }
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

// The record fields only Plan read: the old editor's cards, their bookkeeping and its sheets. They go with the
// record's parts, and leave the record once those have moved (./retired-parts-merge).
export const RETIRED_RECORD_FIELDS = [
  'items',
  'itemsRev',
  'itemsNextKey',
  'itemTypes',
  'sheets',
] as const;

// Whether a stored record must be set aside. A check that throws sets it aside too: a copy costs nothing, and
// content lost to a read cannot be had back.
export function needsSetAside(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const { id, tabs, items, sheets } = record as {
    id?: unknown;
    tabs?: unknown;
    items?: unknown;
    sheets?: unknown;
  };
  if (typeof id !== 'string' || !Array.isArray(tabs)) return false;
  // The old editor kept a document's Plan cards and sheets on the record itself, beside its tabs.
  if (hasEntries(items) || hasEntries(sheets)) return true;
  return tabs.some((tab) => {
    try {
      return hasRetiredContent(tab);
    } catch (err) {
      console.warn('[offline-store] retired-content check failed, set aside', err);
      return true;
    }
  });
}

// One upgrade's set-aside: `consider` a record as it is moved, or `scan` a whole store; it reports once.
export function createSetAside(tx: IDBTransaction) {
  const into = tx.objectStore(RETIRED_PARTS_STORE);
  let seen = 0;
  let kept = 0;
  const consider = (record: unknown) => {
    seen++;
    if (!needsSetAside(record)) return;
    into.put(record);
    kept++;
  };
  const report = () =>
    debugLog(`[offline-store] set aside ${kept} of ${seen} documents with retired parts`);
  const scan = (store: IDBObjectStore) => {
    store.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return report();
      consider(cursor.value);
      cursor.continue();
    };
  };
  return { consider, scan, report };
}
