// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { openOfflineDb } from './offline-backend';
import { offlineListDocuments, offlineLoadTab, offlineSaveTab } from './offline-store';
import { countRetiredParts, listRetiredParts } from './retired-parts';
import {
  deleteOfflineDb,
  holdOpen,
  offlineDbShape,
  readStoreRaw,
  seedOfflineDb,
} from './idb-test-utils';
import { resetOfflineIds } from './offline-ids';

// docs/specs/006-document/offline-mode.md "Retired parts set aside (version 3)". The splitter's check is another
// part's (@liveworkspace/migration/split); here a tab holds retired content when it has pages, and a tab marked
// `explode` makes the check throw.
vi.mock('@liveworkspace/migration/split', () => ({
  hasRetiredContent: (tab: { pages?: unknown; explode?: boolean }) => {
    if (tab.explode) throw new Error('unreadable tab');
    return tab.pages !== undefined;
  },
}));

const pagesTab = {
  id: 'p1',
  name: 'Deck',
  opensIn: 'pages',
  pages: [{ id: 'page-1', kind: 'slide', x: 0, y: 0 }],
  elements: [{ id: 'e1', type: 'shape', shape: 'rect', x: 1, y: 2, w: 3, h: 4 }],
};
const diagramTab = { id: 'd1', name: 'Flow', elements: [] };

const mixed = {
  id: 'mixed',
  name: 'Mixed',
  folderId: null,
  createdAt: 1,
  savedAt: 2,
  tabs: [diagramTab, pagesTab],
};
const plain = {
  id: 'plain',
  name: 'Plain',
  folderId: null,
  createdAt: 1,
  savedAt: 2,
  tabs: [diagramTab],
};

beforeEach(async () => {
  resetOfflineIds();
  await deleteOfflineDb();
});

describe('the version 3 upgrade', () => {
  it('makes both stores empty in a browser that never had the old site', async () => {
    expect(await offlineListDocuments()).toEqual([]);
    expect(await offlineDbShape()).toEqual({ version: 3, stores: ['documents', 'retired-parts'] });
    expect(await countRetiredParts()).toBe(0);
  });

  it('sets aside, untouched, each record of a version 2 database that holds retired content', async () => {
    await seedOfflineDb(2, 'documents', [mixed, plain]);
    const list = await offlineListDocuments();
    expect(list.map((d) => d.id).sort()).toEqual(['mixed', 'plain']);
    expect(await listRetiredParts()).toEqual([mixed]);
    // The documents themselves are left as they were.
    expect(await readStoreRaw('documents')).toEqual([mixed, plain]);
  });

  it('sets nothing aside from a version 2 database the new editor already saved', async () => {
    // Its tabs were read and saved without their Pages content.
    await seedOfflineDb(2, 'documents', [plain, { ...plain, id: 'saved', tabs: [diagramTab] }]);
    await offlineListDocuments();
    expect(await countRetiredParts()).toBe(0);
  });

  it('sets aside as it moves the records of a version 1 database', async () => {
    await seedOfflineDb(1, 'diagrams', [mixed, plain]);
    await offlineListDocuments();
    expect(await offlineDbShape()).toEqual({ version: 3, stores: ['documents', 'retired-parts'] });
    expect(await listRetiredParts()).toEqual([mixed]);
  });

  it('sets aside a record holding Plan cards or sheets beside its tabs', async () => {
    const planned = { ...plain, id: 'planned', items: [{ key: 1 }], sheets: [] };
    await seedOfflineDb(2, 'documents', [
      planned,
      { ...plain, id: 'empty', items: [], sheets: [] },
    ]);
    await offlineListDocuments();
    expect(await listRetiredParts()).toEqual([planned]);
  });

  it('sets aside a record the check throws on', async () => {
    const odd = { ...plain, id: 'odd', tabs: [{ id: 'x', name: 'X', explode: true }] };
    await seedOfflineDb(2, 'documents', [odd]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await offlineListDocuments();
    expect(await listRetiredParts()).toEqual([odd]);
    warn.mockRestore();
  });

  it('runs before any read, so a read and a save never reach the set-aside copy', async () => {
    await seedOfflineDb(2, 'documents', [mixed]);
    const tab = await offlineLoadTab('mixed', 'p1');
    // The editor's read drops the tab's pages...
    expect(tab).not.toHaveProperty('pages');
    await offlineSaveTab('mixed', tab as Tab, 3);
    const [stored] = (await readStoreRaw('documents')) as { tabs: object[] }[];
    expect(stored!.tabs[1]).not.toHaveProperty('pages');
    // ...but the set-aside copy still has them.
    expect(await listRetiredParts()).toEqual([mixed]);
  });

  it('waits out a tab of the old editor holding version 2 open, then sets aside', async () => {
    await seedOfflineDb(2, 'documents', [mixed]);
    const old = await holdOpen(2);
    // The blocked open gives up at once (docs/specs/007-editor/load-recovery.md), and the upgrade waits.
    await expect(offlineListDocuments()).rejects.toMatchObject({
      name: 'OfflineStoreUnavailableError',
    });
    old.close();
    await vi.waitFor(async () => expect((await offlineDbShape()).version).toBe(3));
    expect(await listRetiredParts()).toEqual([mixed]);
    expect((await offlineListDocuments()).map((d) => d.id)).toEqual(['mixed']);
  });

  it('lets go of its own connections when a later version asks', async () => {
    await offlineListDocuments();
    const held = await openOfflineDb();
    const next = await holdOpen(4);
    expect(next.version).toBe(4);
    next.close();
    held.close();
  });
});
