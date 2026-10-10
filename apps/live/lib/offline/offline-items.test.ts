import { afterEach, describe, expect, it } from 'vitest';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from './offline-store';
import { offlineFetchItems, offlineWriteItem, recordItemStore } from './offline-items';
import { fetchItems, writeItem, writeItemComment } from '../api/items';
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

  // The api's field checks run offline too, so Sync to Cloud never meets a card the api would refuse.
  it('checks fields, moves and card types as the api does', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(
      testRecord({
        itemTypes: {
          version: 1,
          types: [
            {
              id: 'task',
              label: 'Task',
              color: '#71717a',
              glyph: 'task',
              fields: [],
              newTitle: 'New task',
              excludedStatuses: ['done'],
            },
          ],
        },
      }),
    );
    const create = (fields: Record<string, unknown>) =>
      offlineWriteItem(
        'd1',
        { kind: 'create', creates: [{ id: 'item-one', type: 'task', fields } as never] },
        ME,
      );
    await expect(create({ title: '   ' })).rejects.toMatchObject({
      status: 400,
      code: 'title_required',
    });
    await expect(create({ title: 'x'.repeat(5000) })).rejects.toMatchObject({
      code: 'title_too_long',
    });
    // Stored as the api stores it: the title trimmed.
    const made = await create({ title: '  One  ', status: 'todo' });
    expect(made.upserts[0]!.fields['title']).toBe('One');
    await expect(
      offlineWriteItem('d1', { kind: 'patch', id: 'item-one', patch: { clear: ['title'] } }, ME),
    ).rejects.toMatchObject({ code: 'title_required' });
    await expect(
      offlineWriteItem(
        'd1',
        { kind: 'move', id: 'item-one', move: { status: 'todo', set: { title: 'no' } } },
        ME,
      ),
    ).rejects.toMatchObject({ code: 'place_invalid' });
    // A status the type leaves out is refused, unless the write puts a change back.
    await expect(
      offlineWriteItem('d1', { kind: 'move', id: 'item-one', move: { status: 'done' } }, ME),
    ).rejects.toMatchObject({ code: 'status_excluded' });
    expect((await offlineGetRecord('d1'))?.items?.[0]?.fields['status']).toBe('todo');
    const undone = await offlineWriteItem(
      'd1',
      { kind: 'move', id: 'item-one', move: { status: 'done' }, undo: true },
      ME,
    );
    expect(undone.upserts[0]!.fields['status']).toBe('done');
  });

  // docs/specs/026-plan/items.md "Comments": an offline document comments locally, by the same rules.
  it('comments on a card in the record: add, resolve, delete, and refuses as the api does', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord());
    const scope = { ownerId: 'owner-me', documentId: 'd1', shareCode: null, tabId: null };
    await writeItem(
      scope,
      { kind: 'create', creates: [{ id: 'item-one', type: 'task', fields: { title: 'One' } }] },
      ME,
    );
    const who = { ownerId: 'owner-me', by: ME };
    const added = await writeItemComment(scope, 'item-one', { kind: 'add', text: 'Hi' }, who);
    const thread = added!.upserts[0]!.fields['comments'] as {
      comments: { id: string; text: string; authorId: string }[];
    };
    expect(thread.comments[0]).toMatchObject({ text: 'Hi', authorId: 'owner-me' });
    expect((await offlineGetRecord('d1'))?.itemsRev).toBe(2);
    const resolved = await writeItemComment(
      scope,
      'item-one',
      { kind: 'resolve', resolved: true },
      who,
    );
    expect(resolved!.upserts[0]!.fields['comments']).toMatchObject({ resolved: true });
    expect(
      await writeItemComment(scope, 'item-one', { kind: 'resolve', resolved: true }, who),
    ).toBeNull();
    await writeItemComment(
      scope,
      'item-one',
      { kind: 'delete', commentId: thread.comments[0]!.id },
      who,
    );
    expect((await offlineGetRecord('d1'))?.items?.[0]?.fields['comments']).toBeUndefined();
    await expect(
      writeItemComment(scope, 'item-one', { kind: 'delete', commentId: 'gone' }, who),
    ).rejects.toMatchObject({ status: 404, code: 'comment_not_found' });
    await expect(
      writeItemComment(scope, 'missing', { kind: 'add', text: 'x' }, who),
    ).rejects.toMatchObject({ status: 404, code: 'item_not_found' });
    await offlinePutRecord(testRecord({ id: 'd2', trashedAt: 5 }));
    await expect(
      writeItemComment({ ...scope, documentId: 'd2' }, 'x', { kind: 'add', text: 'x' }, who),
    ).rejects.toMatchObject({ status: 404 });
  });
});
