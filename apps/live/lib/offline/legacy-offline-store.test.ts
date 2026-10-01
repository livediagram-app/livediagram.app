// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { offlineListDocuments, offlineLoadTab } from './offline-store';

// A browser that stored offline documents before the rename holds them in version 1 of the
// database, in the `diagrams` object store (docs/specs/006-document/offline-mode.md).
function seedVersionOne(records: object[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('livediagram-offline', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('diagrams', { keyPath: 'id' });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('diagrams', 'readwrite');
      for (const r of records) tx.objectStore('diagrams').put(r);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function storeNames(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open('livediagram-offline');
    req.onsuccess = () => {
      const names = [...req.result.objectStoreNames];
      req.result.close();
      resolve(names);
    };
  });
}

const record = (id: string) => ({
  id,
  name: `Doc ${id}`,
  folderId: null,
  createdAt: 1,
  savedAt: 2,
  tabs: [
    {
      id: 't1',
      name: 'Tab',
      kind: 'diagram',
      elements: [
        { id: 'e1', type: 'shape', link: { kind: 'diagram', diagramId: 'other', name: 'Other' } },
      ],
    },
  ],
});

describe('offline store upgrade from the diagrams store', () => {
  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('livediagram-offline');
        req.onsuccess = () => resolve();
      }),
  );

  it('moves every record into the documents store and drops the old one', async () => {
    await seedVersionOne([record('a'), record('b')]);
    const list = await offlineListDocuments();
    expect(list.map((d) => d.id).sort()).toEqual(['a', 'b']);
    expect(await storeNames()).toEqual(['documents']);
  });

  it('keeps the tab kind and upgrades the legacy link on load', async () => {
    await seedVersionOne([record('a')]);
    const tab = (await offlineLoadTab('a', 't1')) as unknown as {
      kind: string;
      elements: { link: unknown }[];
    };
    expect(tab.kind).toBe('diagram');
    expect(tab.elements[0]!.link).toEqual({ kind: 'document', documentId: 'other', name: 'Other' });
  });

  it('starts empty on a browser that never stored anything', async () => {
    expect(await offlineListDocuments()).toEqual([]);
    expect(await storeNames()).toEqual(['documents']);
  });
});
