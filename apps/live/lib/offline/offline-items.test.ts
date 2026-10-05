import { afterEach, describe, expect, it } from 'vitest';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from './offline-store';
import { offlineFetchItems, offlineWriteItem, recordItemStore } from './offline-items';
import { fetchItems, writeItem } from '../api/items';
import { memBackend, testRecord } from './offline-test-utils';
import { ApiError } from '../api/core';

// An offline document's item store (docs/specs/026-plan/items.md "Offline documents"): kept in the
// record, written by the same transitions the api applies, refused by the same rules.

const ME = { id: 'me', name: 'Me', color: '#2563eb' };

afterEach(() => __setOfflineBackend(null));

describe('offline items', () => {
  it('reads an empty store from a record written before items', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord());
    expect(await offlineFetchItems('d1')).toEqual({ items: [], rev: 0, nextKey: 1 });
    expect(recordItemStore(null)).toEqual({ items: [], rev: 0, nextKey: 1 });
  });

  it('creates, moves and deletes in the record, through the dispatching client', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord());
    const scope = { ownerId: 'o', documentId: 'd1', shareCode: null, tabId: null };
    const made = await writeItem(
      scope,
      {
        kind: 'create',
        creates: [{ id: 'item-one', type: 'task', fields: { title: 'One', status: 'todo' } }],
      },
      ME,
    );
    expect(made.upserts[0]).toMatchObject({ id: 'item-one', key: 1, createdBy: ME });
    await writeItem(scope, { kind: 'move', id: 'item-one', move: { status: 'done' } }, ME);
    const rec = await offlineGetRecord('d1');
    expect(rec?.items?.[0]?.fields['status']).toBe('done');
    expect([rec?.itemsRev, rec?.itemsNextKey]).toEqual([2, 2]);
    expect((await fetchItems(scope)).items).toHaveLength(1);
    await writeItem(scope, { kind: 'delete', id: 'item-one' }, ME);
    expect((await offlineGetRecord('d1'))?.items).toEqual([]);
  });

  it('refuses as the api does', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord());
    await expect(
      offlineWriteItem('d1', { kind: 'delete', id: 'missing' }, ME),
    ).rejects.toMatchObject({ status: 404, code: 'item_not_found' });
    await expect(offlineWriteItem('nope', { kind: 'delete', id: 'x' }, ME)).rejects.toBeInstanceOf(
      ApiError,
    );
    await offlinePutRecord(testRecord({ id: 'd2', trashedAt: 5 }));
    await expect(offlineWriteItem('d2', { kind: 'delete', id: 'x' }, ME)).rejects.toMatchObject({
      status: 404,
    });
  });
});
