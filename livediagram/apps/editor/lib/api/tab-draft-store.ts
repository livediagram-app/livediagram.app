// Where the unload flush's drafts live in this browser (docs/specs/006-document/delta-saves.md "Drafts of unsaved
// changes"): one IndexedDB object store, a record per person, document and tab, the key the drafts module makes.
// Every call is guarded and none ever throws: a browser without IndexedDB, a full disk or a private window keeps no
// drafts, and the editor works as before. The connection is opened by the first read (every tab load reads) and kept,
// so the unload flush, which cannot wait, writes on an open connection in the same event.
import type { TabDraftRecord, TabDraftStore } from '@liveworkspace/workbench/lib/api/tab-drafts';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export const TAB_DRAFTS_DB = 'livediagram-drafts';
const STORE = 'drafts';
const DB_VERSION = 1;

/** How long a tab load waits for its draft before going on without it (the draft stays for the next load). Safe
 *  range: 250 ms to 4 s; the tab's own GET is usually slower. */
export const TAB_DRAFT_READ_TIMEOUT_MS = 1_000;

let db: IDBDatabase | null = null;
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(TAB_DRAFTS_DB, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        db = req.result;
        // Never the one holding up a later version's upgrade (another tab on newer code), and a closed connection
        // is opened again on the next call.
        db.onversionchange = () => forget();
        db.onclose = () => forget();
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }).then((opened) => {
    if (!opened) opening = null;
    return opened;
  });
  return opening;
}

function forget(): void {
  try {
    db?.close();
  } catch {
    // Already gone.
  }
  db = null;
  opening = null;
}

// One write on the open connection, committed at once where the browser can (the page may be going); on a
// connection still opening, once it has.
function change(step: (store: IDBObjectStore) => void): void {
  const run = (conn: IDBDatabase | null) => {
    if (!conn) return;
    try {
      const tx = conn.transaction(STORE, 'readwrite');
      step(tx.objectStore(STORE));
      tx.commit?.();
    } catch (err) {
      debugLog('[tab-draft] write failed', { error: String(err) });
    }
  };
  if (db) run(db);
  else void open().then(run);
}

function read(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), TAB_DRAFT_READ_TIMEOUT_MS);
    const done = (value: unknown) => {
      clearTimeout(timer);
      resolve(value);
    };
    void open().then((conn) => {
      if (!conn) return done(undefined);
      try {
        const req = conn.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        req.onsuccess = () => done(req.result);
        req.onerror = () => done(undefined);
      } catch {
        done(undefined);
      }
    });
  });
}

export const tabDraftStore: TabDraftStore = {
  read,
  write: (key: string, record: TabDraftRecord) => change((store) => store.put(record, key)),
  remove: (key: string) => change((store) => store.delete(key)),
};

/** Tests: drop the kept connection, as a new page would start. */
export function resetTabDraftStoreForTests(): void {
  forget();
}
