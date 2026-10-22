// An Offline Mode document's photo blobs, in this browser (docs/specs/031-photo/photo-store.md
// "Offline Mode documents"): IndexedDB `livedesign-photo-blobs`, one record a blob id. Blobs are
// named by content, so every document in the browser shares them.
import type { PhotoBlobEntry } from '@livedesign/api-schema';

const DB_NAME = 'livedesign-photo-blobs';
const STORE = 'blobs';

type Stored = { type: string; bytes: Uint8Array };

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!opening)
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        opening = null;
        reject(req.error ?? new Error('photo blobs: could not open'));
      };
    });
  return opening;
}

function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = body(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        const fail = () => reject(tx.error ?? new Error('photo blobs: transaction failed'));
        tx.onerror = fail;
        tx.onabort = fail;
      }),
  );
}

export async function offlinePutBlobs(entries: readonly PhotoBlobEntry[]): Promise<void> {
  await run('readwrite', (store) => {
    for (const e of entries)
      store.put({ type: e.type, bytes: new Uint8Array(e.bytes) } satisfies Stored, e.id);
  });
}

export async function offlineGetBlob(id: string): Promise<Blob | null> {
  const got = await run<Stored | undefined>(
    'readonly',
    (store) => store.get(id) as IDBRequest<Stored | undefined>,
  );
  return got ? new Blob([got.bytes as Uint8Array<ArrayBuffer>], { type: got.type }) : null;
}

export async function offlineBlobsHeld(ids: readonly string[]): Promise<Set<string>> {
  const held = new Set<string>();
  await Promise.all(
    ids.map(async (id) => {
      const key = await run<IDBValidKey | undefined>('readonly', (store) => store.getKey(id));
      if (key !== undefined) held.add(id);
    }),
  );
  return held;
}

/** Every stored blob of `ids`, for Sync Document to upload. */
export async function offlineBlobsFor(ids: readonly string[]): Promise<PhotoBlobEntry[]> {
  const out: PhotoBlobEntry[] = [];
  for (const id of ids) {
    const got = await run<Stored | undefined>(
      'readonly',
      (store) => store.get(id) as IDBRequest<Stored | undefined>,
    );
    if (got) out.push({ id, type: got.type as PhotoBlobEntry['type'], bytes: got.bytes });
  }
  return out;
}
