// This Browser's folders and the list's version 2 (liveworkspace/docs/specs/004-index/one-explorer.md "This Browser, a
// Space", one-explorer-contracts.md "This Browser's list"): a version 1 list reads with no folders and is written as
// version 2, every write keeps what the app's records don't carry, and the folder verbs keep the tree whole.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { itemsByFolder } from './explorer/this-browser-lens';
import {
  createThisBrowserFolder,
  deleteThisBrowserFolder,
  dropSyncPlace,
  isLocalWithin,
  localChildren,
  localPath,
  moveThisBrowserFolder,
  moveThisBrowserItem,
  noteSyncPlace,
  parseThisBrowserStore,
  putThisBrowserItem,
  readSyncPlaces,
  readThisBrowser,
  readThisBrowserStore,
  renameThisBrowserFolder,
  setThisBrowserArchived,
  subscribeThisBrowser,
  SYNC_PLACE_TTL_MS,
  syncPlaceKey,
  THIS_BROWSER_FOLDER_MAX,
  thisBrowserKey,
  thisBrowserPublisher,
  writeThisBrowser,
  writeThisBrowserStore,
  LOCAL_FOLDER_NAME_MAX,
  type ThisBrowserFolder,
  type ThisBrowserItem,
} from './this-browser';

const APP = 'liveplanner' as const;

const local = (n: number, extra: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: `item-${n}`,
  title: `Local ${n}`,
  createdAt: 1_000 + n,
  updatedAt: 2_000 + n,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  ...extra,
});

const folder = (id: string, parentId: string | null = null, name = id): ThisBrowserFolder => ({
  id,
  name,
  parentId,
  createdAt: 1,
  updatedAt: 1,
});

const stored = () => JSON.parse(localStorage.getItem(thisBrowserKey(APP)) ?? 'null');

afterEach(() => localStorage.clear());

describe('the stored list, version 2', () => {
  it('reads a version 1 list with no folders, every item at the root, and writes it as version 2', () => {
    localStorage.setItem(
      thisBrowserKey(APP),
      JSON.stringify({ v: 1, items: [local(1), local(2)] }),
    );
    expect(readThisBrowserStore(APP)).toEqual({ items: [local(1), local(2)], folders: [] });
    // The next write (an app's own) stores version 2, its items as they were.
    putThisBrowserItem(APP, local(3));
    expect(stored().v).toBe(2);
    expect(stored().folders).toEqual([]);
    expect(readThisBrowser(APP).map((i) => i.id)).toEqual(['item-3', 'item-2', 'item-1']);
  });

  it('reads an unknown version, a garbled value or none as empty', () => {
    expect(parseThisBrowserStore(null)).toEqual({ items: [], folders: [] });
    expect(parseThisBrowserStore('{oops')).toEqual({ items: [], folders: [] });
    expect(parseThisBrowserStore(JSON.stringify({ v: 9, items: [local(1)] }))).toEqual({
      items: [],
      folders: [],
    });
    expect(parseThisBrowserStore(JSON.stringify({ v: 2 }))).toEqual({ items: [], folders: [] });
    localStorage.setItem(thisBrowserKey(APP), 'x');
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(readThisBrowserStore(APP, blocked)).toEqual({ items: [], folders: [] });
  });

  it('puts an item whose folder is gone at the root, and a folder whose parent is gone too', () => {
    const raw = JSON.stringify({
      v: 2,
      items: [local(1, { folderId: 'gone' }), local(2, { folderId: 'a' })],
      folders: [
        folder('a'),
        folder('b', 'missing'),
        folder('self', 'self'),
        { id: '', name: 'no id' },
        { id: 'c', name: 7 },
        null,
        { id: 'd', name: 'D', parentId: 5, createdAt: 'no', updatedAt: 'no' },
      ],
    });
    const read = parseThisBrowserStore(raw);
    expect(read.items).toEqual([local(1), local(2, { folderId: 'a' })]);
    expect(read.folders.map((f) => [f.id, f.parentId])).toEqual([
      ['a', null],
      ['b', null],
      ['self', null],
      ['d', null],
    ]);
    expect(read.folders[3]).toEqual({
      id: 'd',
      name: 'D',
      parentId: null,
      createdAt: 0,
      updatedAt: 0,
    });
  });

  it("keeps the folders, each item's folder and archive mark through the app's republish", () => {
    writeThisBrowserStore(APP, {
      items: [local(1, { folderId: 'a' }), local(2)],
      folders: [folder('a')],
    });
    setThisBrowserArchived(APP, 'item-2', 50);
    const list = thisBrowserPublisher(APP, () => null);
    const rec = (n: number) => ({
      id: `item-${n}`,
      name: `Local ${n}`,
      createdAt: 1,
      savedAt: 5 + n,
    });
    list.publish([rec(1), rec(2), rec(3)]);
    const read = readThisBrowserStore(APP);
    expect(read.folders).toEqual([folder('a')]);
    expect(read.items.find((i) => i.id === 'item-1')?.folderId).toBe('a');
    expect(read.items.find((i) => i.id === 'item-2')?.archivedAt).toBe(50);
    expect(read.items.find((i) => i.id === 'item-3')?.folderId).toBeUndefined();
    // A note from the app (no folder on its record) keeps it, and changes nothing when nothing listed changed.
    const heard = vi.fn();
    const stop = subscribeThisBrowser(APP, heard);
    list.note('item-1', rec(1));
    expect(heard).not.toHaveBeenCalled();
    stop();
    // An explicit move to the root clears it.
    writeThisBrowser(APP, [{ ...read.items.find((i) => i.id === 'item-1')!, folderId: null }]);
    expect(readThisBrowserStore(APP).items[0]?.folderId).toBeUndefined();
  });

  it('keeps the key while it holds a folder alone, and removes it when empty', () => {
    writeThisBrowserStore(APP, { items: [], folders: [folder('a')] });
    expect(stored()).toEqual({ v: 2, items: [], folders: [folder('a')] });
    writeThisBrowser(APP, []);
    expect(stored().folders).toEqual([folder('a')]);
    deleteThisBrowserFolder(APP, 'a');
    expect(localStorage.getItem(thisBrowserKey(APP))).toBeNull();
  });

  it('goes without when storage is missing or refuses the write', () => {
    expect(() =>
      writeThisBrowserStore(APP, { items: [local(1)], folders: [] }, null),
    ).not.toThrow();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    } as unknown as Storage;
    const heard = vi.fn();
    const stop = subscribeThisBrowser(APP, heard);
    writeThisBrowserStore(APP, { items: [local(1)], folders: [] }, full);
    expect(heard).not.toHaveBeenCalled();
    expect(createThisBrowserFolder(APP, 'A', null, full)).toBeNull();
    stop();
  });
});

describe('the folder verbs', () => {
  it('makes folders at the root and inside one, trimmed and bounded, and refuses a blank name or a gone parent', () => {
    const heard = vi.fn();
    const stop = subscribeThisBrowser(APP, heard);
    const a = createThisBrowserFolder(APP, '  Trips  ', null, undefined, 10)!;
    expect(a).toEqual(expect.objectContaining({ name: 'Trips', parentId: null, createdAt: 10 }));
    expect(a.id).toMatch(/^local-/);
    const b = createThisBrowserFolder(APP, 'x'.repeat(300), a.id)!;
    expect(b.name).toHaveLength(LOCAL_FOLDER_NAME_MAX);
    expect(b.parentId).toBe(a.id);
    expect(createThisBrowserFolder(APP, '   ', null)).toBeNull();
    expect(createThisBrowserFolder(APP, 'Lost', 'nowhere')).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });

  it('makes a folder id without crypto.randomUUID too', () => {
    const was = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
    try {
      expect(createThisBrowserFolder(APP, 'A', null)?.id).toMatch(/^local-[a-z0-9]+-[a-z0-9]+$/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: was, configurable: true });
    }
  });

  it('stops at THIS_BROWSER_FOLDER_MAX', () => {
    writeThisBrowserStore(APP, {
      items: [],
      folders: Array.from({ length: THIS_BROWSER_FOLDER_MAX }, (_, i) => folder(`f${i}`)),
    });
    expect(createThisBrowserFolder(APP, 'One more', null)).toBeNull();
    expect(readThisBrowserStore(APP).folders).toHaveLength(THIS_BROWSER_FOLDER_MAX);
  });

  it('renames one, and does nothing for a blank or the same name or a gone folder', () => {
    writeThisBrowserStore(APP, { items: [], folders: [folder('a', null, 'Old')] });
    expect(renameThisBrowserFolder(APP, 'a', ' New ', undefined, 99)).toBe(true);
    expect(readThisBrowserStore(APP).folders[0]).toEqual(
      expect.objectContaining({ name: 'New', updatedAt: 99 }),
    );
    expect(renameThisBrowserFolder(APP, 'a', 'New')).toBe(false);
    expect(renameThisBrowserFolder(APP, 'a', '  ')).toBe(false);
    expect(renameThisBrowserFolder(APP, 'gone', 'X')).toBe(false);
  });

  it('deletes one, moving its folders and items up a level and deleting nothing else', () => {
    writeThisBrowserStore(APP, {
      items: [local(1, { folderId: 'b' }), local(2, { folderId: 'a' }), local(3)],
      folders: [folder('a'), folder('b', 'a'), folder('c', 'b')],
    });
    expect(deleteThisBrowserFolder(APP, 'b')).toBe(true);
    const after = readThisBrowserStore(APP);
    expect(after.folders.map((f) => [f.id, f.parentId])).toEqual([
      ['a', null],
      ['c', 'a'],
    ]);
    expect(after.items.map((i) => [i.id, i.folderId ?? null])).toEqual([
      ['item-3', null],
      ['item-2', 'a'],
      ['item-1', 'a'],
    ]);
    // At the root its contents land at the root.
    expect(deleteThisBrowserFolder(APP, 'a')).toBe(true);
    const root = readThisBrowserStore(APP);
    expect(root.items.every((i) => i.folderId === undefined)).toBe(true);
    expect(root.folders).toEqual([expect.objectContaining({ id: 'c', parentId: null })]);
    expect(deleteThisBrowserFolder(APP, 'gone')).toBe(false);
  });

  it('moves a folder, never into itself or below itself', () => {
    writeThisBrowserStore(APP, {
      items: [],
      folders: [folder('a'), folder('b', 'a'), folder('c')],
    });
    expect(moveThisBrowserFolder(APP, 'a', 'b')).toBe(false);
    expect(moveThisBrowserFolder(APP, 'a', 'a')).toBe(false);
    expect(moveThisBrowserFolder(APP, 'a', 'nowhere')).toBe(false);
    expect(moveThisBrowserFolder(APP, 'a', null)).toBe(false);
    expect(moveThisBrowserFolder(APP, 'gone', null)).toBe(false);
    expect(moveThisBrowserFolder(APP, 'a', 'c')).toBe(true);
    expect(moveThisBrowserFolder(APP, 'b', null)).toBe(true);
    expect(readThisBrowserStore(APP).folders.map((f) => [f.id, f.parentId])).toEqual([
      ['a', 'c'],
      ['b', null],
      ['c', null],
    ]);
  });

  it('moves an item in and out of a folder', () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [folder('a')] });
    expect(moveThisBrowserItem(APP, 'item-1', 'a')).toBe(true);
    expect(readThisBrowser(APP)[0]?.folderId).toBe('a');
    expect(moveThisBrowserItem(APP, 'item-1', 'a')).toBe(false);
    expect(moveThisBrowserItem(APP, 'item-1', 'nowhere')).toBe(false);
    expect(moveThisBrowserItem(APP, 'gone', null)).toBe(false);
    expect(moveThisBrowserItem(APP, 'item-1', null)).toBe(true);
    expect(readThisBrowser(APP)[0]?.folderId).toBeUndefined();
  });

  it('walks the tree: children by name, the path down to one, and what is within', () => {
    const tree = [
      folder('b', null, 'beta'),
      folder('a', null, 'Alpha'),
      folder('c', 'a'),
      folder('d', 'c'),
    ];
    expect(localChildren(tree, null).map((f) => f.id)).toEqual(['a', 'b']);
    expect(localPath(tree, 'd').map((f) => f.id)).toEqual(['a', 'c', 'd']);
    expect(localPath(tree, null)).toEqual([]);
    expect(localPath(tree, 'gone')).toEqual([]);
    expect(isLocalWithin(tree, 'd', 'a')).toBe(true);
    expect(isLocalWithin(tree, 'b', 'a')).toBe(false);
    // A cycle in a stored list stops the walk.
    expect(localPath([folder('x', 'y'), folder('y', 'x')], 'x').map((f) => f.id)).toEqual([
      'y',
      'x',
    ]);
  });
});

describe('where a handed-over Sync lands', () => {
  it('notes a place, reads it while in time, drops it after a day or once used', () => {
    noteSyncPlace(APP, 'item-1', { teamId: null, folderId: 'acct-1' }, undefined, 1_000);
    noteSyncPlace(APP, 'item-2', { teamId: 'team-1', folderId: null }, undefined, 1_000);
    // My Work's root needs no note: noting it there clears an older one.
    noteSyncPlace(APP, 'item-3', { teamId: null, folderId: 'acct-3' }, undefined, 1_000);
    noteSyncPlace(APP, 'item-3', { teamId: null, folderId: null }, undefined, 1_000);
    expect(readSyncPlaces(APP, undefined, 2_000)).toEqual([
      { id: 'item-1', teamId: null, folderId: 'acct-1', at: 1_000 },
      { id: 'item-2', teamId: 'team-1', folderId: null, at: 1_000 },
    ]);
    dropSyncPlace(APP, 'item-2');
    dropSyncPlace(APP, 'never');
    expect(readSyncPlaces(APP, undefined, 2_000).map((p) => p.id)).toEqual(['item-1']);
    expect(readSyncPlaces(APP, undefined, 1_000 + SYNC_PLACE_TTL_MS)).toEqual([]);
    expect(localStorage.getItem(syncPlaceKey(APP))).toBeNull();
  });

  it('reads a garbled note as none, and goes without storage', () => {
    localStorage.setItem(syncPlaceKey(APP), '{bad');
    expect(readSyncPlaces(APP)).toEqual([]);
    localStorage.setItem(
      syncPlaceKey(APP),
      JSON.stringify({ a: null, b: { at: 'x' }, c: { at: 1 }, d: { at: 1, folderId: 'f' } }),
    );
    expect(readSyncPlaces(APP, undefined, 2).map((p) => p.id)).toEqual(['d']);
    expect(() => noteSyncPlace(APP, 'x', { teamId: null, folderId: 'f' }, null)).not.toThrow();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    } as unknown as Storage;
    expect(() => noteSyncPlace(APP, 'x', { teamId: null, folderId: 'f' }, full)).not.toThrow();
  });
});

describe('the cost of a full list', () => {
  // The worst case the caps allow: 500 items, each in a folder, and 200 folders nested one inside the next. The
  // Explorer parses the list once per change and walks the tree for the open folder's path and the cards' counts.
  it('parses and walks it well inside a frame', () => {
    const folders = Array.from({ length: THIS_BROWSER_FOLDER_MAX }, (_, i) =>
      folder(`f${i}`, i === 0 ? null : `f${i - 1}`, `Folder ${i}`),
    );
    const items = Array.from({ length: 500 }, (_, i) => local(i, { folderId: `f${i % 200}` }));
    const raw = JSON.stringify({ v: 2, items, folders });
    const ms = cpuMsOf(() => {
      for (let n = 0; n < 20; n++) {
        const read = parseThisBrowserStore(raw);
        itemsByFolder(read.items);
        localPath(read.folders, 'f199');
        for (const f of read.folders) localChildren(read.folders, f.id);
      }
    });
    if (process.env.MEASURE) console.log(`full list: ${(ms / 20).toFixed(2)} ms per pass`);
    expect(ms / 20).toBeLessThan(cpuBudgetMs(8));
  });
});
