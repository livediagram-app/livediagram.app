// The `retired-parts` store (docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps"):
// the raw copies the version 3 upgrade set aside (./retired-parts-upgrade), read for the offer, and settled once a
// document's parts have moved.

import type { LocalPartsBody } from '../api/migration';
import { forgetOfflineId } from './offline-ids';
import { OFFLINE_DOCUMENTS_STORE, openOfflineDb } from './offline-backend';
import { serializeOfflineWrite, type OfflineDocumentRecord } from './offline-store';
import { mergeKeptTabs } from './retired-parts-merge';
import { RETIRED_PARTS_STORE } from './retired-parts-upgrade';
import { noteThisBrowser } from './this-browser';

// A document record exactly as it was stored before any read: its tabs may hold content this editor's types do not
// describe, so they are unknown here.
export type RetiredPartsRecord = Omit<OfflineDocumentRecord, 'tabs'> & { tabs: unknown[] };

// What `POST /api/migration/local-parts` is sent for one set-aside record: everything on it, raw (its id lets the api
// make the same part ids on a retry, so a lost answer never makes duplicates). The
// old owner id comes from the record when it has one, else from the old site's guest key while this browser still
// holds it (the splitter uses it to recompute card people).
export function localPartsBody(
  record: RetiredPartsRecord,
  oldOwnerId: string | null,
): LocalPartsBody {
  const raw = record as RetiredPartsRecord & Record<string, unknown>;
  const body: Record<string, unknown> = {
    id: record.id,
    name: record.name ?? '',
    tabs: record.tabs,
  };
  for (const key of [
    'createdAt',
    'savedAt',
    'presentation',
    'items',
    'itemsRev',
    'itemsNextKey',
    'itemTypes',
    'sheets',
  ] as const) {
    if (raw[key] !== undefined) body[key] = raw[key];
  }
  const ownerId = typeof raw.ownerId === 'string' ? raw.ownerId : oldOwnerId;
  if (ownerId) body.ownerId = ownerId;
  return body as LocalPartsBody;
}

// What settling a document did to its record in This Browser.
export type RetiredPartsSettled = 'written' | 'deleted' | 'missing';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

async function read<T>(op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openOfflineDb();
  try {
    return await request(
      op(db.transaction(RETIRED_PARTS_STORE, 'readonly').objectStore(RETIRED_PARTS_STORE)),
    );
  } finally {
    db.close();
  }
}

export function countRetiredParts(): Promise<number> {
  return read((s) => s.count());
}

// In the store's own order (by id); the dialog sorts by name.
export function listRetiredParts(): Promise<RetiredPartsRecord[]> {
  return read((s) => s.getAll() as IDBRequest<RetiredPartsRecord[]>);
}

// After a document's parts moved: write `keep` back into its record (./retired-parts-merge) and delete its row, in
// one transaction over both stores, so neither can happen without the other. Queued behind this tab's other
// offline writes.
export function settleRetiredParts(id: string, keep: unknown[]): Promise<RetiredPartsSettled> {
  return serializeOfflineWrite(async () => {
    const db = await openOfflineDb();
    let outcome: RetiredPartsSettled = 'missing';
    let after: OfflineDocumentRecord | 'delete' | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([OFFLINE_DOCUMENTS_STORE, RETIRED_PARTS_STORE], 'readwrite');
        const documents = tx.objectStore(OFFLINE_DOCUMENTS_STORE);
        const parts = tx.objectStore(RETIRED_PARTS_STORE);
        const aside = parts.get(id) as IDBRequest<RetiredPartsRecord | undefined>;
        const current = documents.get(id) as IDBRequest<OfflineDocumentRecord | undefined>;
        current.onsuccess = () => {
          const setAside = aside.result;
          if (setAside && current.result) {
            const merged = mergeKeptTabs(current.result, setAside, keep);
            if (merged.tabs.length === 0) {
              documents.delete(id);
              after = 'delete';
              outcome = 'deleted';
            } else {
              documents.put(merged);
              after = merged;
              outcome = 'written';
            }
          }
          parts.delete(id);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB settle aborted'));
      });
    } finally {
      db.close();
    }
    if (after === 'delete') forgetOfflineId(id);
    if (after) noteThisBrowser(id, after);
    return outcome;
  });
}
