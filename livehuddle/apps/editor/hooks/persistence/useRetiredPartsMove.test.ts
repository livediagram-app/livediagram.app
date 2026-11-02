// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { LocalPartsAnswer, LocalPartsRequest } from '@liveworkspace/migration';
import { ApiError } from '@/lib/api-client';
import { deleteOfflineDb, readStoreRaw, seedOfflineDb } from '@/lib/offline/idb-test-utils';
import { offlineListDocuments, offlineLoadTab, offlineSaveTab } from '@/lib/offline/offline-store';
import { resetOfflineIds } from '@/lib/offline/offline-ids';
import { countRetiredParts, listRetiredParts } from '@/lib/offline/retired-parts';
import { moveRetiredParts } from './useRetiredPartsMove';

// docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps": Move Them posts each set-aside
// document's raw tabs as the person, writes the answer's `keep` back and drops the set-aside row; a failure keeps
// both.

vi.mock('@liveworkspace/migration/split', () => ({
  hasRetiredContent: (tab: { pages?: unknown }) => tab.pages !== undefined,
}));

const moveLocalParts =
  vi.fn<(owner: string, req: LocalPartsRequest) => Promise<LocalPartsAnswer>>();
vi.mock('@/lib/api/migration', () => ({
  apiMoveLocalParts: (owner: string, req: LocalPartsRequest) => moveLocalParts(owner, req),
}));
const tracked: string[] = [];
vi.mock('@/lib/telemetry', () => ({
  track: (c: string, a: string, t?: string) => tracked.push(`${c}·${a}·${t}`),
}));

const diagramTab = {
  id: 'd1',
  name: 'Flow',
  elements: [{ id: 'e1', type: 'shape', shape: 'rect' }],
};
const deckTab = {
  id: 'p1',
  name: 'Deck',
  opensIn: 'pages',
  pages: [{ id: 'page-1' }],
  elements: [],
};
const mixed = {
  id: 'mixed',
  name: 'Mixed',
  folderId: null,
  createdAt: 1,
  savedAt: 2,
  tabs: [diagramTab, deckTab],
};
const other = { ...mixed, id: 'other', name: 'Other' };

const answer: LocalPartsAnswer = {
  parts: [
    {
      app: 'livedocuments',
      id: 'n1',
      url: 'https://livedocuments.app/document/n1',
      tabIds: ['p1'],
    },
  ],
  keep: [diagramTab],
};

beforeEach(async () => {
  resetOfflineIds();
  moveLocalParts.mockReset();
  tracked.length = 0;
  await deleteOfflineDb();
  await seedOfflineDb(2, 'documents', [mixed]);
  // The first open sets the record aside.
  await offlineListDocuments();
});

describe('moving retired parts', () => {
  it('posts the raw tabs as the person, writes keep back and drops the set-aside row', async () => {
    moveLocalParts.mockResolvedValue(answer);
    const result = await moveRetiredParts('guest_me', () => {});
    expect(moveLocalParts).toHaveBeenCalledWith('guest_me', {
      id: 'mixed',
      name: 'Mixed',
      tabs: mixed.tabs,
      createdAt: 1,
      savedAt: 2,
    });
    expect(result).toEqual({
      moved: [
        {
          id: 'mixed',
          name: 'Mixed',
          parts: [{ app: 'livedocuments', url: 'https://livedocuments.app/document/n1' }],
        },
      ],
      failed: [],
    });
    expect(await readStoreRaw('documents')).toEqual([{ ...mixed, tabs: [diagramTab] }]);
    expect(await countRetiredParts()).toBe(0);
    expect(await offlineLoadTab('mixed', 'p1')).toBeNull();
    expect(tracked).toEqual(['Document·Moved·RetiredParts']);
  });

  it('sends the raw tabs even after the editor read and saved the document', async () => {
    // Opened and saved with no change: the stored tab has lost its pages.
    const read = await offlineLoadTab('mixed', 'p1');
    await offlineSaveTab('mixed', read!, 3);
    moveLocalParts.mockResolvedValue(answer);
    await moveRetiredParts('user_1', () => {});
    expect(moveLocalParts.mock.calls[0]![1].tabs[1]).toHaveProperty('pages');
    // Nobody changed the tab, so it still counts as moved, not as edited here.
    const [stored] = (await readStoreRaw('documents')) as { tabs: unknown[] }[];
    expect(stored!.tabs).toEqual([diagramTab]);
  });

  it('keeps a tab edited since the set-aside', async () => {
    const read = await offlineLoadTab('mixed', 'p1');
    const edited = {
      ...read!,
      elements: [{ id: 'new', type: 'shape', shape: 'rect' }],
    } as unknown as Tab;
    await offlineSaveTab('mixed', edited, 3);
    moveLocalParts.mockResolvedValue(answer);
    await moveRetiredParts('user_1', () => {});
    const [stored] = (await readStoreRaw('documents')) as { tabs: { id: string }[] }[];
    expect(stored!.tabs.map((t) => t.id)).toEqual(['d1', 'p1']);
  });

  it('keeps the record and its set-aside copy when the move fails, and says which', async () => {
    moveLocalParts.mockRejectedValue(new ApiError('move local parts', 503, null));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await moveRetiredParts('guest_me', () => {});
    warn.mockRestore();
    expect(result).toEqual({ moved: [], failed: ['Mixed'] });
    expect(await readStoreRaw('documents')).toEqual([mixed]);
    expect(await listRetiredParts()).toEqual([mixed]);
    expect(tracked).toEqual([]);
  });

  it('sends the Plan cards and sheets kept on the record, and drops them once they moved', async () => {
    await deleteOfflineDb();
    const planned = {
      ...mixed,
      id: 'planned',
      tabs: [diagramTab],
      ownerId: 'old-owner',
      items: [{ key: 1, title: 'Card' }],
      itemsRev: 3,
      itemsNextKey: 2,
      sheets: [{ id: 's1', tabId: 'b1' }],
    };
    await seedOfflineDb(2, 'documents', [planned]);
    await offlineListDocuments();
    moveLocalParts.mockResolvedValue({ ...answer, keep: [diagramTab] });
    await moveRetiredParts('guest_me', () => {});
    expect(moveLocalParts.mock.calls[0]![1]).toEqual({
      id: 'planned',
      name: 'Mixed',
      tabs: [diagramTab],
      createdAt: 1,
      savedAt: 2,
      ownerId: 'old-owner',
      items: planned.items,
      itemsRev: 3,
      itemsNextKey: 2,
      sheets: planned.sheets,
    });
    const [stored] = (await readStoreRaw('documents')) as Record<string, unknown>[];
    expect(stored).not.toHaveProperty('items');
    expect(stored).not.toHaveProperty('sheets');
    expect(stored!.ownerId).toBe('old-owner');
  });

  it('removes a record whose every tab moved', async () => {
    moveLocalParts.mockResolvedValue({ ...answer, keep: [] });
    await moveRetiredParts('guest_me', () => {});
    expect(await readStoreRaw('documents')).toEqual([]);
    expect(await countRetiredParts()).toBe(0);
  });

  it('still moves the parts of a record that has gone, and leaves it gone', async () => {
    await deleteOfflineDb();
    // Only the set-aside copy is left (the record was synced to the cloud since).
    await seedOfflineDb(2, 'documents', [other]);
    await offlineListDocuments();
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('livehuddle-offline');
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').delete('other');
      tx.oncomplete = () => resolve();
    });
    db.close();
    moveLocalParts.mockResolvedValue(answer);
    const progress: number[] = [];
    const result = await moveRetiredParts('guest_me', (done) => progress.push(done));
    expect(result.moved.map((d) => d.id)).toEqual(['other']);
    expect(progress).toEqual([0]);
    expect(await readStoreRaw('documents')).toEqual([]);
    expect(await countRetiredParts()).toBe(0);
  });
});
