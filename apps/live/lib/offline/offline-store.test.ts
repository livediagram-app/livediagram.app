import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { OfflineDocumentRecord } from './offline-store';
import {
  __setOfflineBackend,
  applyMeta,
  isOfflineId,
  isOfflineIdSync,
  offlineCreateDocument,
  offlineDeleteIfUnchanged,
  offlineGetRecord,
  offlinePutRecord,
  offlineDeleteDocument,
  offlineDeleteTab,
  offlineListDocuments,
  offlineLoadDocument,
  offlineLoadTab,
  offlineSaveDocumentMeta,
  offlineSaveTab,
  offlineSetDocumentFolder,
  OFFLINE_OWNER_ID,
  recordToDocument,
  removeTab,
  tabToSummary,
  upsertTab,
} from './offline-store';
import { memBackend, testRecord as rec, testTab as tab } from './offline-test-utils';
import { nextLocalOpens } from './offline-opens';

afterEach(() => __setOfflineBackend(null));

describe('offline transforms', () => {
  it('projects a record into a valid, unshared document', () => {
    const d = recordToDocument(rec({ tabs: [tab('t1', { folder: 'A' })] }));
    expect(d).toMatchObject({
      id: 'd1',
      ownerId: OFFLINE_OWNER_ID,
      shareable: false,
      shareCode: null,
      teamId: null,
      source: null,
    });
    expect(d.tabs).toEqual([
      { id: 't1', documentId: 'd1', name: 't1', orderIndex: 0, updatedAt: 100, folder: 'A' },
    ]);
  });

  it('tabToSummary omits folder when absent', () => {
    expect(tabToSummary(tab('t1'), 'd1', 2, 5)).toEqual({
      id: 't1',
      documentId: 'd1',
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
    await offlineCreateDocument({ id: 'd1', name: 'Doc', tabs: [tab('t1')] }, 100);

    expect(await isOfflineId('d1')).toBe(true);
    expect(await isOfflineId('other')).toBe(false);
    expect((await offlineLoadDocument('d1'))?.name).toBe('Doc');
    expect((await offlineListDocuments()).map((s) => s.id)).toEqual(['d1']);

    await offlineDeleteDocument('d1');
    expect(await isOfflineId('d1')).toBe(false);
    expect(await offlineLoadDocument('d1')).toBeNull();
  });

  it('starts the record of uses with its making (docs/specs/013-workspace/explorer-home.md)', async () => {
    const backend = memBackend();
    __setOfflineBackend(backend);
    const now = Date.UTC(2026, 9, 3, 18);
    await offlineCreateDocument({ id: 'd1', name: 'Doc' }, now);
    expect((await backend.get('d1'))?.opens).toEqual(nextLocalOpens(undefined, now));
    expect((await backend.get('d1'))?.opens).toEqual({ days: ['2026-10-03'], lastOpenedAt: now });
  });

  it('starts no record for a making that is no use (a bulk import)', async () => {
    const backend = memBackend();
    __setOfflineBackend(backend);
    await offlineCreateDocument({ id: 'd1', name: 'Doc' }, 100, { markUsed: false });
    expect((await backend.get('d1'))?.opens).toBeUndefined();
  });

  it('migrates a tab saved against a retired scheme on load (docs/specs/011-theme/retired-schemes.md)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    __setOfflineBackend(memBackend());
    const charcoal = tab('t1', {
      theme: 'charcoal',
      backgroundColor: '#2b2b33',
      patternColor: '#636373',
    });
    await offlineCreateDocument({ id: 'd1', name: 'Doc', tabs: [charcoal] }, 100);
    expect(await offlineLoadTab('d1', 't1')).toMatchObject({
      theme: 'brand',
      backgroundColor: '#0d121a',
    });
  });

  it('saves + loads + deletes individual tabs', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'd1', name: 'Doc', tabs: [] }, 100);

    await offlineSaveTab('d1', tab('t1', { name: 'First' }), 150);
    expect((await offlineLoadTab('d1', 't1'))?.name).toBe('First');

    await offlineSaveTab('d1', tab('t1', { name: 'Edited' }), 160);
    expect((await offlineLoadTab('d1', 't1'))?.name).toBe('Edited');

    await offlineDeleteTab('d1', 't1', 170);
    expect(await offlineLoadTab('d1', 't1')).toBeNull();
  });

  it('setDocumentFolder updates the personal-tree placement', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'd1', name: 'Doc', tabs: [] }, 100);
    await offlineSetDocumentFolder('d1', 'f1', 200);
    expect((await offlineListDocuments())[0]?.folderId).toBe('f1');
    // No creation intent is recorded in the browser (docs/specs/013-workspace/default-folders.md).
    expect((await offlineListDocuments())[0]).toMatchObject({
      opensIn: null,
      tabKind: null,
      templateFamily: null,
    });
    await offlineSetDocumentFolder('d1', null, 300);
    expect((await offlineListDocuments())[0]?.folderId).toBeNull();
  });

  it('saveDocumentMeta renames without touching tabs', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'd1', name: 'Doc', tabs: [tab('t1')] }, 100);
    await offlineSaveDocumentMeta('d1', { name: 'Renamed' }, 200);
    expect((await offlineLoadDocument('d1'))?.name).toBe('Renamed');
  });
});

// Both stores must agree on what a tab IS. An offline board that lost its
// kind would come back from a Sync Document as an ordinary diagram — the
// cloud copy would then be wrong too, and nothing could tell.
describe('upsertTab — tab kind', () => {
  const rec = (): OfflineDocumentRecord =>
    ({
      id: 'off:1',
      name: 'D',
      folderId: null,
      createdAt: 1,
      savedAt: 1,
      tabs: [],
    }) satisfies OfflineDocumentRecord;
  const tab = (over: Partial<Tab> = {}): Tab =>
    ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

  it('stamps the ordinary kind on the way in', () => {
    expect(upsertTab(rec(), tab(), 2).tabs[0]!.kind).toBe('diagram');
  });

  it('keeps a workshop board a workshop board', () => {
    expect(upsertTab(rec(), tab({ kind: 'event-storming' }), 2).tabs[0]!.kind).toBe(
      'event-storming',
    );
    const legacy = tab({ layers: [{ id: 'layer:es:board', name: 'Event Storming' }] });
    expect(upsertTab(rec(), legacy, 2).tabs[0]!.kind).toBe('event-storming');
  });
});

describe('offlineDeleteIfUnchanged (Sync Document, docs/specs/006-document/offline-mode.md)', () => {
  it('removes the record and forgets the id when it still matches', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(rec({ id: 'd1', savedAt: 5 }));
    const out = await offlineDeleteIfUnchanged('d1', (r) => r.savedAt === 5);
    expect(out).toMatchObject({ outcome: 'deleted', rec: { savedAt: 5 } });
    expect(await offlineGetRecord('d1')).toBeNull();
    expect(isOfflineIdSync('d1')).toBe(false);
  });

  it('keeps a record that changed, answering it as it is now', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(rec({ id: 'd1', savedAt: 5 }));
    await offlineSaveTab('d1', tab('t9'), 6);
    const out = await offlineDeleteIfUnchanged('d1', (r) => r.savedAt === 5);
    expect(out).toMatchObject({ outcome: 'changed', rec: { savedAt: 6 } });
    expect(await offlineGetRecord('d1')).not.toBeNull();
    expect(isOfflineIdSync('d1')).toBe(true);
  });

  it('answers missing for a record already gone', async () => {
    __setOfflineBackend(memBackend());
    expect(await offlineDeleteIfUnchanged('gone', () => true)).toEqual({ outcome: 'missing' });
  });
});
