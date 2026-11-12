import { describe, expect, it, vi } from 'vitest';
import {
  applyMeta,
  createOfflineStore,
  removeTab,
  tabToSummaryFor,
  upsertTabWith,
  type OfflineChange,
  type OfflineStoreBackend,
} from './offline-store-core';

// The shared Offline Mode store. Each editor's lib/offline/offline-store.test.ts drives its own binding over a fake
// IndexedDB; these pin the shared transforms and operations over an in-memory backend.

type Tab = { id: string; name: string; folder?: string };
type Rec = {
  id: string;
  name: string;
  tabs: Tab[];
  savedAt: number;
  favourite?: boolean;
  trashedAt?: number;
};

function memoryBackend(): OfflineStoreBackend<Rec> & { rows: Map<string, Rec> } {
  const rows = new Map<string, Rec>();
  return {
    rows,
    get: async (id) => rows.get(id),
    put: async (rec) => void rows.set(rec.id, rec),
    delete: async (id) => void rows.delete(id),
    all: async () => [...rows.values()],
    update: async (id, change: OfflineChange<Rec>) => {
      const next = change(rows.get(id));
      if (next === 'delete') rows.delete(id);
      else if (next) rows.set(id, next);
    },
  };
}

function store() {
  const db = memoryBackend();
  const ids = new Set<string>();
  const heard: [string, unknown][] = [];
  const s = createOfflineStore<Tab, Rec, Rec, { id: string }>({
    backend: () => db,
    rememberId: (id) => void ids.add(id),
    forgetId: (id) => void ids.delete(id),
    isOfflineIdSync: (id) => ids.has(id),
    noteThisBrowser: (id, after) => void heard.push([id, after]),
    toItem: (rec) => rec,
    toSummary: (rec) => ({ id: rec.id }),
    migrateTab: (tab) => ({ ...tab, name: tab.name.trim() }),
    trashedError: (id) => new Error(`trashed ${id}`),
    missingError: (id) => new Error(`missing ${id}`),
  });
  return { s, db, ids, heard };
}

const rec = (over: Partial<Rec> = {}): Rec => ({
  id: 'o1',
  name: 'One',
  tabs: [{ id: 't1', name: ' Tab 1 ' }],
  savedAt: 1,
  ...over,
});

describe('the pure transforms', () => {
  it('names the summary id under the product key, with a folder only when set', () => {
    const toSummary = tabToSummaryFor('designId');
    expect(toSummary({ id: 't', name: 'T' }, 'd', 2, 9)).toEqual({
      id: 't',
      designId: 'd',
      name: 'T',
      orderIndex: 2,
      updatedAt: 9,
    });
    expect(toSummary({ id: 't', name: 'T', folder: 'F' }, 'd', 0, 9)).toMatchObject({
      folder: 'F',
    });
  });

  it('applies a meta change: rename, reorder, refolder, drop unknown ids, a deck only when given', () => {
    const r = rec({
      tabs: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B', folder: 'X' },
      ],
    });
    const next = applyMeta(
      r,
      { tabs: [{ id: 'b', folder: 'X' }, { id: 'zz' }, { id: 'a', folder: 'Y' }] },
      5,
    );
    expect(next.tabs).toEqual([r.tabs[1], { id: 'a', name: 'A', folder: 'Y' }]);
    expect(next.tabs[0]).toBe(r.tabs[1]);
    expect(next.name).toBe('One');
    expect(next.savedAt).toBe(5);
    expect(next).not.toHaveProperty('presentation');
    expect(applyMeta(r, { name: 'Two', presentation: null }, 6)).toMatchObject({
      name: 'Two',
      presentation: null,
      tabs: r.tabs,
    });
  });

  it('upserts in place or appends, stamping the tab, and removes a tab', () => {
    const r = rec({
      tabs: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    });
    expect(upsertTabWith(r, { id: 'a', name: 'A2' }, 3).tabs.map((t) => t.name)).toEqual([
      'A2',
      'B',
    ]);
    const stamped = upsertTabWith(r, { id: 'c', name: 'C' }, 3, (t) => ({ ...t, folder: 'K' }));
    expect(stamped.tabs.at(-1)).toEqual({ id: 'c', name: 'C', folder: 'K' });
    expect(removeTab(r, 'a', 4)).toMatchObject({ tabs: [{ id: 'b' }], savedAt: 4 });
  });
});

describe('the operations', () => {
  it('creates, lists live records only, loads, and migrates a tab on read', async () => {
    const { s, ids, heard } = store();
    expect(await s.createRecord(rec())).toEqual(rec());
    expect(ids.has('o1')).toBe(true);
    expect(heard).toEqual([['o1', rec()]]);
    await s.offlinePutRecord(rec({ id: 'o2', trashedAt: 3 }));
    expect(await s.listItems()).toEqual([{ id: 'o1' }]);
    expect(await s.loadItem('o1')).toEqual(rec());
    expect(await s.loadItem('nope')).toBeNull();
    await expect(s.loadItem('o2')).rejects.toThrow('trashed o2');
    expect(await s.loadTab('o1', 't1')).toEqual({ id: 't1', name: 'Tab 1' });
    expect(await s.loadTab('o1', 'zz')).toBeNull();
    expect(await s.loadTab('nope', 't1')).toBeNull();
    expect(await s.offlineGetRecord('o1')).toEqual(rec());
    expect(await s.offlineGetRecord('nope')).toBeNull();
  });

  it('stars without touching savedAt, and lists live favourites', async () => {
    const { s } = store();
    await s.createRecord(rec());
    await s.createRecord(rec({ id: 'o2', favourite: true, trashedAt: 2 }));
    await s.setFavourite('o1', true);
    await s.setFavourite('missing', true);
    expect((await s.offlineGetRecord('o1'))?.savedAt).toBe(1);
    expect(await s.listFavouriteIds()).toEqual(['o1']);
  });

  it('writes a live record, skips a trashed one, and fails a listed missing one once', async () => {
    const { s, db, ids } = store();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await s.createRecord(rec());
    await s.deleteTab('o1', 't1', 7);
    expect(db.rows.get('o1')).toMatchObject({ tabs: [], savedAt: 7 });
    db.rows.set('o1', rec({ trashedAt: 8 }));
    await s.writeLive('o1', (r) => ({ ...r, name: 'changed' }));
    expect(db.rows.get('o1')?.name).toBe('One');
    // Missing and unlisted: a no-op. Missing and listed: the id is forgotten and the write fails.
    await s.writeLive('gone', (r) => r);
    ids.add('gone');
    await expect(s.writeLive('gone', (r) => r)).rejects.toThrow('missing gone');
    expect(ids.has('gone')).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('serialises writes, and a failed one does not stall the chain', async () => {
    const { s } = store();
    const order: number[] = [];
    const first = s.serializeOfflineWrite(async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push(1);
      throw new Error('boom');
    });
    const second = s.serializeOfflineWrite(async () => void order.push(2));
    await expect(first).rejects.toThrow('boom');
    await second;
    expect(order).toEqual([1, 2]);
  });

  it('deletes, and deletes only an unchanged record on sync', async () => {
    const { s, ids, heard } = store();
    await s.createRecord(rec());
    await s.deleteItem('o1');
    expect(ids.has('o1')).toBe(false);
    expect(heard.at(-1)).toEqual(['o1', 'delete']);
    expect(await s.offlineDeleteIfUnchanged('o1', () => true)).toEqual({ outcome: 'missing' });
    await s.createRecord(rec());
    expect(await s.offlineDeleteIfUnchanged('o1', () => false)).toEqual({
      outcome: 'changed',
      rec: rec(),
    });
    expect(ids.has('o1')).toBe(true);
    expect(await s.offlineDeleteIfUnchanged('o1', () => true)).toEqual({
      outcome: 'deleted',
      rec: rec(),
    });
    expect(ids.has('o1')).toBe(false);
    expect(await s.offlineGetRecord('o1')).toBeNull();
  });
});
