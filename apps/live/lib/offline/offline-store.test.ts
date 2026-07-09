import { afterEach, describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import {
  __setOfflineBackend,
  applyMeta,
  isOfflineId,
  offlineCreateDiagram,
  offlineDeleteDiagram,
  offlineDeleteTab,
  offlineListDiagrams,
  offlineLoadDiagram,
  offlineLoadTab,
  offlineSaveDiagramMeta,
  offlineSaveTab,
  OFFLINE_OWNER_ID,
  recordToDiagram,
  removeTab,
  tabToSummary,
  upsertTab,
  type OfflineBackend,
  type OfflineDiagramRecord,
} from './offline-store';

const tab = (id: string, over: Partial<Tab> = {}): Tab => ({ id, name: id, elements: [], ...over });
const rec = (over: Partial<OfflineDiagramRecord> = {}): OfflineDiagramRecord => ({
  id: 'd1',
  name: 'Doc',
  folderId: null,
  createdAt: 100,
  savedAt: 100,
  tabs: [tab('t1'), tab('t2')],
  ...over,
});

function memBackend(): OfflineBackend {
  const map = new Map<string, OfflineDiagramRecord>();
  return {
    get: async (id) => map.get(id),
    put: async (r) => void map.set(r.id, r),
    delete: async (id) => void map.delete(id),
    all: async () => [...map.values()],
  };
}

afterEach(() => __setOfflineBackend(null));

describe('offline transforms', () => {
  it('projects a record into a valid, unshared Diagram', () => {
    const d = recordToDiagram(rec({ tabs: [tab('t1', { folder: 'A' })] }));
    expect(d).toMatchObject({
      id: 'd1',
      ownerId: OFFLINE_OWNER_ID,
      shareable: false,
      shareCode: null,
      teamId: null,
      source: null,
    });
    expect(d.tabs).toEqual([
      { id: 't1', diagramId: 'd1', name: 't1', orderIndex: 0, updatedAt: 100, folder: 'A' },
    ]);
  });

  it('tabToSummary omits folder when absent', () => {
    expect(tabToSummary(tab('t1'), 'd1', 2, 5)).toEqual({
      id: 't1',
      diagramId: 'd1',
      name: 't1',
      orderIndex: 2,
      updatedAt: 5,
    });
  });

  it('applyMeta renames and reorders tabs by id + refreshes folder', () => {
    const out = applyMeta(
      rec(),
      { name: 'New', tabs: [{ id: 't2', folder: 'F' }, { id: 't1' }] },
      200,
    );
    expect(out.name).toBe('New');
    expect(out.savedAt).toBe(200);
    expect(out.tabs.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(out.tabs[0]!.folder).toBe('F');
  });

  it('upsertTab appends a new tab and replaces an existing one', () => {
    const appended = upsertTab(rec(), tab('t3'), 200);
    expect(appended.tabs.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    const replaced = upsertTab(rec(), tab('t1', { name: 'renamed' }), 200);
    expect(replaced.tabs[0]!.name).toBe('renamed');
    expect(replaced.tabs).toHaveLength(2);
  });

  it('removeTab drops the tab', () => {
    expect(removeTab(rec(), 't1', 200).tabs.map((t) => t.id)).toEqual(['t2']);
  });
});

describe('offline store ops (in-memory backend)', () => {
  it('create → load → list → isOfflineId → delete round-trip', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDiagram({ id: 'd1', name: 'Doc', tabs: [tab('t1')] }, 100);

    expect(await isOfflineId('d1')).toBe(true);
    expect(await isOfflineId('other')).toBe(false);
    expect((await offlineLoadDiagram('d1'))?.name).toBe('Doc');
    expect((await offlineListDiagrams()).map((s) => s.id)).toEqual(['d1']);

    await offlineDeleteDiagram('d1');
    expect(await isOfflineId('d1')).toBe(false);
    expect(await offlineLoadDiagram('d1')).toBeNull();
  });

  it('saves + loads + deletes individual tabs', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDiagram({ id: 'd1', name: 'Doc', tabs: [] }, 100);

    await offlineSaveTab('d1', tab('t1', { name: 'First' }), 150);
    expect((await offlineLoadTab('d1', 't1'))?.name).toBe('First');

    await offlineSaveTab('d1', tab('t1', { name: 'Edited' }), 160);
    expect((await offlineLoadTab('d1', 't1'))?.name).toBe('Edited');

    await offlineDeleteTab('d1', 't1', 170);
    expect(await offlineLoadTab('d1', 't1')).toBeNull();
  });

  it('saveDiagramMeta renames without touching tabs', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDiagram({ id: 'd1', name: 'Doc', tabs: [tab('t1')] }, 100);
    await offlineSaveDiagramMeta('d1', { name: 'Renamed' }, 200);
    expect((await offlineLoadDiagram('d1'))?.name).toBe('Renamed');
  });
});
