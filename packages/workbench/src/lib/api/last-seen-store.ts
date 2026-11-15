// Where the last seen copies live in this browser (each product's docs/specs/006-*/offline-mode.md "Warm open of a
// cloud document", livediagram's blueprints/last-seen-copy.md): one IndexedDB database per product
// (`livediagram-last-seen`, ...) with two object stores under the same key, `copies` (the bodies) and `seen` (who read
// each one and when, small rows the prune lists without loading a body). Every call is bounded and none ever throws: a
// browser without IndexedDB, a full disk or a private window keeps no copies and the editor works as before. The
// connection is opened by the first call and kept.
import { debugLog } from '../debug-log';

const COPIES = 'copies';
const SEEN = 'seen';
const DB_VERSION = 1;

/** How long any store call may take before it answers as if the store were empty. Bounds sign-out's clear and a
 *  warm open's read. Safe range: 250 ms to 4 s. */
export const LAST_SEEN_TIMEOUT_MS = 1_000;

/** One copy as stored in `copies`. */
export type LastSeenRecord = {
  v: number;
  reader: string;
  itemId: string;
  seenAt: number;
  // The copy's JSON: kept as text so its size is known before it is written.
  body: string;
};

/** One row of `seen`, with its key. */
export type LastSeenEntry = { key: string; reader: string; seenAt: number };

/** The store the copies are kept in. No call rejects. */
export type LastSeenStore = {
  get: (key: string) => Promise<unknown>;
  // Whether the write committed.
  put: (key: string, record: LastSeenRecord) => Promise<boolean>;
  remove: (keys: readonly string[]) => Promise<void>;
  entries: () => Promise<LastSeenEntry[]>;
  clear: () => Promise<void>;
};

/** The store, and `reset` (tests: drop the kept connection, as a new page would start). */
export function createLastSeenStore(dbName: string): LastSeenStore & { reset: () => void } {
  let db: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase | null> | null = null;

  function forget(): void {
    try {
      db?.close();
    } catch {
      // Already gone.
    }
    db = null;
    opening = null;
  }

  function open(): Promise<IDBDatabase | null> {
    if (db) return Promise.resolve(db);
    opening ??= new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(dbName, DB_VERSION);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(COPIES);
          req.result.createObjectStore(SEEN);
        };
        req.onsuccess = () => {
          db = req.result;
          // Never the one holding up a later version's upgrade (another tab on newer code); a closed connection is
          // opened again on the next call.
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

  // One transaction over `stores`: `step` queues its requests and answers what the call resolves with once the
  // transaction completes. Anything that goes wrong, or takes past the timeout, resolves `fallback`.
  function run<T>(
    mode: IDBTransactionMode,
    stores: string[],
    fallback: T,
    step: (tx: IDBTransaction) => () => T,
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      let settled = false;
      const done = (value: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => done(fallback), LAST_SEEN_TIMEOUT_MS);
      void open().then((conn) => {
        if (!conn) return done(fallback);
        try {
          const tx = conn.transaction(stores, mode);
          const answer = step(tx);
          tx.oncomplete = () => done(answer());
          tx.onerror = tx.onabort = () => {
            debugLog('[last-seen] transaction failed', { error: String(tx.error) });
            done(fallback);
          };
        } catch (err) {
          debugLog('[last-seen] transaction failed', { error: String(err) });
          done(fallback);
        }
      });
    });
  }

  return {
    get: (key) =>
      run<unknown>('readonly', [COPIES], undefined, (tx) => {
        const req = tx.objectStore(COPIES).get(key);
        return () => req.result as unknown;
      }),
    put: (key, record) =>
      run('readwrite', [COPIES, SEEN], false, (tx) => {
        tx.objectStore(COPIES).put(record, key);
        tx.objectStore(SEEN).put({ reader: record.reader, seenAt: record.seenAt }, key);
        return () => true;
      }),
    remove: (keys) =>
      keys.length === 0
        ? Promise.resolve()
        : run('readwrite', [COPIES, SEEN], undefined, (tx) => {
            for (const key of keys) {
              tx.objectStore(COPIES).delete(key);
              tx.objectStore(SEEN).delete(key);
            }
            return () => undefined;
          }),
    entries: () =>
      run<LastSeenEntry[]>('readonly', [SEEN], [], (tx) => {
        const store = tx.objectStore(SEEN);
        const keys = store.getAllKeys();
        const rows = store.getAll();
        return () =>
          (rows.result as { reader: string; seenAt: number }[]).map((row, i) => ({
            // Every key this store writes is a string (lastSeenKey).
            key: keys.result[i] as string,
            reader: row.reader,
            seenAt: row.seenAt,
          }));
      }),
    clear: () =>
      run('readwrite', [COPIES, SEEN], undefined, (tx) => {
        tx.objectStore(COPIES).clear();
        tx.objectStore(SEEN).clear();
        return () => undefined;
      }),
    reset: forget,
  };
}
