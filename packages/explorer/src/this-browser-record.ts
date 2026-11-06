// Deleting an item kept only in this browser from the Explorer page on the app's own address
// (liveworkspace/docs/specs/004-index/one-explorer.md "Take Offline, Sync and Delete"), in place: the page shares the
// app's origin, so it can reach the app's offline store, and removing a record needs nothing of what it holds. The
// store's names are the registry's (`offlineStore`), the same the app's editor opens it by.
//
// It never creates or upgrades the database: it opens it at whatever version it is, and where the database or its
// store isn't there (an editor never opened here, or not since an upgrade renamed its store) it answers `unreachable`,
// and the caller hands the Delete over to the editor instead.
import type { App } from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { dropThisBrowserItem } from './this-browser';
import { dropInboxItem } from './this-browser-inbox';

export type ThisBrowserRecordRemoval = 'removed' | 'unreachable';

// How long the database may take to open and delete: past it the hand-over takes over.
export const THIS_BROWSER_REMOVE_TIMEOUT_MS = 4000;

type Deps = {
  indexedDB?: IDBFactory | undefined;
  // The app's offline-ids channel, told so its open editor tabs stop routing writes to the item.
  tell?: (channel: string, message: { kind: 'remove'; id: string }) => void;
  timeoutMs?: number;
};

const broadcast = (channel: string, message: { kind: 'remove'; id: string }) => {
  if (typeof BroadcastChannel === 'undefined') return;
  const c = new BroadcastChannel(channel);
  try {
    c.postMessage(message);
  } finally {
    c.close();
  }
};

/** Deletes one item's record from the app's offline store, for good, then drops it from This Browser's list and its
 *  rows from the Inbox snapshot. Never throws: `unreachable` when it couldn't. */
export async function removeThisBrowserRecord(
  app: App,
  id: string,
  {
    indexedDB: idb = globalThis.indexedDB,
    tell = broadcast,
    timeoutMs = THIS_BROWSER_REMOVE_TIMEOUT_MS,
  }: Deps = {},
): Promise<ThisBrowserRecordRemoval> {
  const { db: dbName, store } = APP_ITEMS[app].offlineStore;
  if (!idb) return 'unreachable';
  const deleted = await new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (ok: boolean, db?: IDBDatabase) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db?.close();
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    let req: IDBOpenDBRequest;
    try {
      // No version: the database as it is. A missing one would be made here, so its making is called off.
      req = idb.open(dbName);
    } catch {
      done(false);
      return;
    }
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onerror = () => done(false);
    req.onblocked = () => done(false);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      if (!db.objectStoreNames.contains(store)) {
        done(false, db);
        return;
      }
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => done(true, db);
        tx.onerror = () => done(false, db);
        tx.onabort = () => done(false, db);
      } catch {
        done(false, db);
      }
    };
  });
  if (!deleted) return 'unreachable';
  try {
    tell(dbName, { kind: 'remove', id });
  } catch {
    // An editor tab that misses this finds the record gone on its next read, and never writes it back.
  }
  dropThisBrowserItem(app, id);
  dropInboxItem(app, id);
  return 'removed';
}
