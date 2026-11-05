// The Explorer page's in-place Delete of an item kept only in this browser (liveworkspace/docs/specs/004-index/
// one-explorer.md "Take Offline, Sync and Delete"): the record leaves the app's offline store, the open editor tabs are
// told, and the item leaves This Browser's list and the Inbox; where the store isn't there, nothing is made.
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { APP_ITEMS } from '@liveworkspace/sites';
import { readThisBrowser, writeThisBrowser } from './this-browser';
import { readInboxSnapshot, writeInboxSnapshot } from './this-browser-inbox';
import { removeThisBrowserRecord } from './this-browser-record';

const { db: DB, store: STORE } = APP_ITEMS.livedocuments.offlineStore;

async function seed(idb: IDBFactory, ids: string[], version = 2, store = STORE): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = idb.open(DB, version);
    req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'id' });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(store, 'readwrite');
      for (const id of ids) tx.objectStore(store).put({ id, name: id });
      tx.oncomplete = () => {
        req.result.close();
        resolve();
      };
    };
  });
}

async function keys(idb: IDBFactory): Promise<string[]> {
  return new Promise((resolve) => {
    const req = idb.open(DB);
    req.onsuccess = () => {
      const all = req.result.transaction(STORE).objectStore(STORE).getAllKeys();
      all.onsuccess = () => {
        req.result.close();
        resolve((all.result as string[]).sort());
      };
    };
  });
}

const item = (id: string) => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: 1,
  trashedAt: null,
  favourite: false,
});

describe('removeThisBrowserRecord', () => {
  it('deletes the one record, tells the editor tabs, and drops it from the list and the Inbox', async () => {
    const idb = new IDBFactory();
    await seed(idb, ['a', 'b']);
    writeThisBrowser('livedocuments', [item('a'), item('b')]);
    const row = { itemId: 'a', actionId: 'x' } as never;
    const other = { itemId: 'b', actionId: 'y' } as never;
    writeInboxSnapshot('livedocuments', ['me'], { actions: [row, other], threads: [] });
    const tell = vi.fn();

    await expect(
      removeThisBrowserRecord('livedocuments', 'a', { indexedDB: idb, tell }),
    ).resolves.toBe('removed');
    expect(await keys(idb)).toEqual(['b']);
    expect(tell).toHaveBeenCalledWith(DB, { kind: 'remove', id: 'a' });
    expect(readThisBrowser('livedocuments').map((i) => i.id)).toEqual(['b']);
    expect(readInboxSnapshot('livedocuments')!.rows.actions.map((r) => r.itemId)).toEqual(['b']);
  });

  it('never makes the database where there is none, and answers unreachable', async () => {
    const idb = new IDBFactory();
    const tell = vi.fn();
    await expect(
      removeThisBrowserRecord('livedocuments', 'a', { indexedDB: idb, tell }),
    ).resolves.toBe('unreachable');
    expect((await idb.databases()).map((d) => d.name)).not.toContain(DB);
    expect(tell).not.toHaveBeenCalled();
  });

  it('answers unreachable where the store is named otherwise (an editor not opened since an upgrade)', async () => {
    const idb = new IDBFactory();
    await seed(idb, ['a'], 1, 'older-name');
    writeThisBrowser('livedocuments', [item('a')]);
    await expect(removeThisBrowserRecord('livedocuments', 'a', { indexedDB: idb })).resolves.toBe(
      'unreachable',
    );
    expect(readThisBrowser('livedocuments').map((i) => i.id)).toEqual(['a']);
  });

  it('answers unreachable without IndexedDB, or when it never answers', async () => {
    await expect(
      removeThisBrowserRecord('livedocuments', 'a', { indexedDB: undefined }),
    ).resolves.toBe('unreachable');
    const silent = { open: () => ({}) } as unknown as IDBFactory;
    await expect(
      removeThisBrowserRecord('livedocuments', 'a', { indexedDB: silent, timeoutMs: 10 }),
    ).resolves.toBe('unreachable');
  });

  it('has a store named for every app', () => {
    for (const app of Object.keys(APP_ITEMS) as (keyof typeof APP_ITEMS)[]) {
      expect(APP_ITEMS[app].offlineStore.db).toBe(`${app}-offline`);
      expect(APP_ITEMS[app].offlineStore.store).toMatch(/^[a-z]+$/);
    }
  });
});
