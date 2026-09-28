import { afterEach, describe, expect, it } from 'vitest';
import { TRASH_RETENTION_MS } from '@livediagram/api-schema';
import {
  __setOfflineBackend,
  isOfflineId,
  offlineListDiagrams,
  offlineListFavouriteIds,
  offlineLoadDiagram,
  offlinePutRecord,
  offlineSaveDiagramMeta,
  offlineSaveTab,
  offlineGetRecord,
} from './offline-store';
import {
  offlineListTrash,
  offlinePurgeDiagram,
  offlinePurgeExpiredTrash,
  offlineRestoreDiagram,
  offlineTrashDiagram,
} from './offline-trash';
import { DiagramTrashedError } from '../diagram-trashed';
import { memBackend, testRecord as rec, testTab as tab } from './offline-test-utils';

// The local Trash (docs/specs/013-workspace/trash.md, "The local Trash"): an
// offline diagram's delete marks its IndexedDB record trashed; the same 30-day
// rule applies, run whenever the app lists diagrams.

const T0 = 1_700_000_000_000;

afterEach(() => __setOfflineBackend(null));

async function seeded(...recs: Parameters<typeof rec>[0][]) {
  __setOfflineBackend(memBackend());
  for (const r of recs) await offlinePutRecord(rec(r));
}

describe('offlineTrashDiagram', () => {
  it('keeps the record but leaves it out of the list, the stars and loading', async () => {
    await seeded({ id: 'd1', favourite: true }, { id: 'd2' });

    await offlineTrashDiagram('d1', T0);

    expect((await offlineListDiagrams()).map((d) => d.id)).toEqual(['d2']);
    expect(await offlineListFavouriteIds()).toEqual([]);
    await expect(offlineLoadDiagram('d1')).rejects.toBeInstanceOf(DiagramTrashedError);
    expect((await offlineGetRecord('d1'))?.trashedAt).toBe(T0);
    // Still this browser's diagram: the dispatch keeps routing it locally.
    expect(await isOfflineId('d1')).toBe(true);
  });

  it('keeps the first deletion time', async () => {
    await seeded({ id: 'd1' });
    await offlineTrashDiagram('d1', T0);
    await offlineTrashDiagram('d1', T0 + 5);
    expect((await offlineGetRecord('d1'))?.trashedAt).toBe(T0);
  });

  it('refuses saves while trashed', async () => {
    await seeded({ id: 'd1' });
    await offlineTrashDiagram('d1', T0);

    await offlineSaveTab('d1', tab('t9'), T0 + 1);
    await offlineSaveDiagramMeta('d1', { name: 'Renamed' }, T0 + 1);

    const stored = await offlineGetRecord('d1');
    expect(stored?.tabs.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(stored?.name).toBe('Doc');
  });
});

describe('offlineListTrash', () => {
  it('lists the trashed records, newest first, as this-browser rows', async () => {
    await seeded({ id: 'd1', name: 'One' }, { id: 'd2', name: 'Two' }, { id: 'd3' });
    await offlineTrashDiagram('d1', T0);
    await offlineTrashDiagram('d2', T0 + 1);

    expect(await offlineListTrash()).toEqual([
      {
        id: 'd2',
        name: 'Two',
        teamId: null,
        teamName: null,
        trashedAt: T0 + 1,
        purgeAt: T0 + 1 + TRASH_RETENTION_MS,
      },
      {
        id: 'd1',
        name: 'One',
        teamId: null,
        teamName: null,
        trashedAt: T0,
        purgeAt: T0 + TRASH_RETENTION_MS,
      },
    ]);
  });
});

describe('offlineRestoreDiagram', () => {
  it('brings the record back into the list, star and all', async () => {
    await seeded({ id: 'd1', favourite: true, folderId: 'F' });
    await offlineTrashDiagram('d1', T0);

    expect(await offlineRestoreDiagram('d1')).toBe(true);

    expect((await offlineListDiagrams()).map((d) => [d.id, d.folderId])).toEqual([['d1', 'F']]);
    expect(await offlineListFavouriteIds()).toEqual(['d1']);
    expect(await offlineListTrash()).toEqual([]);
  });

  it('does nothing for a live or missing record', async () => {
    await seeded({ id: 'd1' });
    expect(await offlineRestoreDiagram('d1')).toBe(false);
    expect(await offlineRestoreDiagram('nope')).toBe(false);
  });
});

describe('offlinePurgeDiagram', () => {
  it('removes a trashed record for good', async () => {
    await seeded({ id: 'd1' });
    await offlineTrashDiagram('d1', T0);

    expect(await offlinePurgeDiagram('d1')).toBe(true);

    expect(await offlineGetRecord('d1')).toBeNull();
    expect(await isOfflineId('d1')).toBe(false);
  });

  it('never purges a live record', async () => {
    await seeded({ id: 'd1' });
    expect(await offlinePurgeDiagram('d1')).toBe(false);
    expect(await offlineGetRecord('d1')).not.toBeNull();
  });
});

describe('offlinePurgeExpiredTrash', () => {
  it('purges records 30 days in the Trash, and nothing younger', async () => {
    await seeded({ id: 'old' }, { id: 'young' }, { id: 'live' });
    const now = T0 + TRASH_RETENTION_MS;
    await offlineTrashDiagram('old', T0);
    await offlineTrashDiagram('young', T0 + 1);

    expect(await offlinePurgeExpiredTrash(now)).toBe(1);

    expect(await offlineGetRecord('old')).toBeNull();
    expect(await offlineGetRecord('young')).not.toBeNull();
    expect(await offlineGetRecord('live')).not.toBeNull();
  });
});
