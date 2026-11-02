import { afterEach, describe, expect, it } from 'vitest';
import type { CardThread } from '@liveplanner/project';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from './offline-store';
import { memBackend, testRecord } from './offline-test-utils';
import { offlineFetchItems } from './offline-items';
import { migratedRecord, recordThreads, threadsAfterItemWrite } from './offline-threads';
import { fetchThreads, writeThread } from '../api/card-threads';
import { writeItem } from '../api/items';

// A This Browser plan's comment threads (docs/specs/026-plan/items.md "Comments", "Offline projects"): kept in the
// record beside its items, written by the same rules the api applies, a card's old single thread read as its
// first thread, and cards coming and going.

const ME = { id: 'me', name: 'Gentle Falcon', color: '#2563eb' };
const who = { ownerId: 'owner-me', by: ME };
const A = 'item-aaaa';
const B = 'item-bbbb';
const scope = { ownerId: 'owner-me', projectId: 'd1', shareCode: null, tabId: null };

afterEach(() => __setOfflineBackend(null));

async function withCards(...ids: string[]) {
  __setOfflineBackend(memBackend());
  await offlinePutRecord(testRecord());
  await writeItem(
    scope,
    {
      kind: 'create',
      creates: ids.map((id) => ({ id, type: 'task', fields: { title: `Card ${id}` } })),
    },
    ME,
  );
}

const started = async (itemId: string, text: string) => {
  const answer = await writeThread(scope, { kind: 'start', itemId, text }, who);
  return ('thread' in answer ? answer.thread : null)!;
};

describe('offline threads', () => {
  it('starts, replies, edits, resolves, renames and deletes, through the dispatching client', async () => {
    await withCards(A, B);
    const t = await started(A, 'Basket empties after switching restaurants');
    expect(t).toMatchObject({
      title: 'Gentle Falcon: Basket empties after switching restaurants',
      home: 'd1',
      cards: [{ projectId: 'd1', itemId: A, key: 1 }],
    });
    expect(t.comments[0]).toMatchObject({ authorId: 'owner-me', authorName: 'Gentle Falcon' });
    const reply = await writeThread(scope, { kind: 'reply', threadId: t.id, text: 'Again' }, who);
    expect('commentId' in reply && reply.commentId).toBeTruthy();
    const id = t.comments[0]!.id;
    await writeThread(scope, { kind: 'edit', threadId: t.id, commentId: id, text: 'Fixed' }, who);
    // docs/specs/012-collaboration/comment-reactions.md: a This Browser plan keeps its reactions too.
    const react = {
      kind: 'react',
      threadId: t.id,
      commentId: id,
      emoji: 'eyes',
      key: 'k-me',
    } as const;
    const reacted = await writeThread(scope, { ...react, on: true }, who);
    expect('thread' in reacted && reacted.thread?.comments[0]?.reactions).toEqual([
      { emoji: 'eyes', by: 'k-me', name: 'Gentle Falcon' },
    ]);
    expect(await writeThread(scope, { ...react, on: true }, who)).toEqual({ unchanged: true });
    await writeThread(scope, { kind: 'resolve', threadId: t.id, resolved: true }, who);
    // Already resolved: nothing.
    expect(
      await writeThread(scope, { kind: 'resolve', threadId: t.id, resolved: true }, who),
    ).toEqual({ unchanged: true });
    await writeThread(scope, { kind: 'rename', threadId: t.id, title: 'Basket bug' }, who);
    await writeThread(scope, { kind: 'addToCard', threadId: t.id, itemId: B }, who);
    const [held] = await fetchThreads(scope);
    expect(held).toMatchObject({
      title: 'Basket bug',
      resolved: true,
      resolvedBy: 'Gentle Falcon',
    });
    expect(held!.comments.map((c) => c.text)).toEqual(['Fixed', 'Again']);
    expect(held!.cards.map((c) => c.itemId)).toEqual([A, B]);
    // The last comment takes the thread.
    await writeThread(
      scope,
      { kind: 'delete', threadId: t.id, commentId: held!.comments[1]!.id },
      who,
    );
    const last = await writeThread(scope, { kind: 'delete', threadId: t.id, commentId: id }, who);
    expect(last).toEqual({ thread: null });
    expect(await fetchThreads(scope)).toEqual([]);
    const other = await started(A, 'Second');
    expect(await writeThread(scope, { kind: 'deleteThread', threadId: other.id }, who)).toEqual({
      thread: null,
    });
  });

  // docs/specs/026-plan/item-types.md "Comments and Votes fields".
  it('starts a thread in one of the card type’s Comments fields, and refuses any other', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(
      testRecord({
        itemTypes: {
          version: 1,
          types: [
            {
              id: 'task',
              label: 'Task',
              newTitle: 'New task',
              glyph: 'task',
              color: '#71717a',
              fields: ['title', 'comments', 'f-review'],
              custom: [{ id: 'f-review', label: 'Design Review', kind: 'comments' }],
            },
          ],
        },
      }),
    );
    await writeItem(
      scope,
      { kind: 'create', creates: [{ id: A, type: 'task', fields: { title: 'Card' } }] },
      ME,
    );
    const start = (field: string) =>
      writeThread(scope, { kind: 'start', itemId: A, text: 'x', field }, who);
    const review = await start('f-review');
    expect('thread' in review && review.thread?.field).toBe('f-review');
    const builtIn = await start('comments');
    expect('thread' in builtIn && builtIn.thread).not.toHaveProperty('field');
    await expect(start('f-gone')).rejects.toMatchObject({ code: 'field_invalid' });
  });

  it('refuses as the api does', async () => {
    await withCards(A);
    const t = await started(A, 'Hi');
    await expect(
      writeThread(scope, { kind: 'start', itemId: 'nope', text: 'x' }, who),
    ).rejects.toMatchObject({
      status: 404,
      code: 'item_not_found',
    });
    await expect(
      writeThread(scope, { kind: 'reply', threadId: 'th-none', text: 'x' }, who),
    ).rejects.toMatchObject({ status: 404, code: 'thread_not_found' });
    await expect(
      writeThread(scope, { kind: 'rename', threadId: t.id, title: 'x'.repeat(121) }, who),
    ).rejects.toMatchObject({ code: 'title_too_long' });
    await expect(
      writeThread(scope, { kind: 'addToCard', threadId: t.id, itemId: 'zz' }, who),
    ).rejects.toMatchObject({ code: 'item_not_found' });
    await expect(
      writeThread(scope, { kind: 'addToCard', threadId: t.id, itemId: A }, who),
    ).rejects.toMatchObject({ code: 'thread_on_card' });
    // Someone else's comment (a record shared in a sync) is theirs to edit.
    const rec = (await offlineGetRecord('d1'))!;
    rec.threads![0]!.comments[0]!.authorId = 'someone-else';
    await offlinePutRecord(rec);
    await expect(
      writeThread(
        scope,
        { kind: 'edit', threadId: t.id, commentId: t.comments[0]!.id, text: 'x' },
        who,
      ),
    ).rejects.toMatchObject({ status: 403 });
    // A thread holding someone else's comment is resolved, never deleted.
    await expect(
      writeThread(scope, { kind: 'deleteThread', threadId: t.id }, who),
    ).rejects.toMatchObject({ status: 409, code: 'thread_has_others' });
    await offlinePutRecord(testRecord({ id: 'd2', trashedAt: 5 }));
    await expect(
      writeThread({ ...scope, projectId: 'd2' }, { kind: 'start', itemId: A, text: 'x' }, who),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('caps the threads on one card', async () => {
    await withCards(A);
    const rec = (await offlineGetRecord('d1'))!;
    const one = await started(A, 'one');
    rec.threads = Array.from({ length: 50 }, (_, i): CardThread => ({
      ...one,
      id: `th-${String(i).padStart(16, '0')}`,
    }));
    await offlinePutRecord(rec);
    await expect(
      writeThread(scope, { kind: 'start', itemId: A, text: 'x' }, who),
    ).rejects.toMatchObject({
      code: 'threads_full',
    });
    await expect(
      writeThread(scope, { kind: 'addToCard', threadId: `th-${'0'.repeat(16)}`, itemId: A }, who),
    ).rejects.toMatchObject({ code: 'threads_full' });
  });

  it('reads a card’s old single thread as its first thread, and moves it on the next write', async () => {
    __setOfflineBackend(memBackend());
    const old = {
      comments: [
        { id: 'c1', text: 'Old words', createdAt: 3, authorName: 'Ada', authorColor: '#111111' },
      ],
      resolved: true,
    };
    await offlinePutRecord(
      testRecord({
        items: [
          {
            id: A,
            type: 'task',
            key: 1,
            rank: 'i',
            fields: { title: 'A', comments: old },
            rev: 1,
            createdAt: 0,
            updatedAt: 0,
            createdBy: ME,
            updatedBy: ME,
          },
        ],
        itemsRev: 1,
        itemsNextKey: 2,
      }),
    );
    const [t] = await fetchThreads(scope);
    expect(t).toMatchObject({ id: 'c-item-aaaa', resolved: true, title: 'Ada: Old words' });
    expect((await offlineFetchItems('d1')).items[0]!.fields).toEqual({ title: 'A' });
    await writeThread(scope, { kind: 'resolve', threadId: 'c-item-aaaa', resolved: false }, who);
    const rec = (await offlineGetRecord('d1'))!;
    expect(rec.items![0]!.fields).toEqual({ title: 'A' });
    expect(rec.threads!.map((x) => [x.id, x.resolved])).toEqual([['c-item-aaaa', false]]);
    expect(migratedRecord(rec)).toBe(rec);
    expect(recordThreads({ id: 'd1' })).toEqual([]);
  });

  it('takes a deleted card off its threads, and puts a restored one back on them', async () => {
    await withCards(A, B);
    const shared = await started(A, 'Shared');
    await writeThread(scope, { kind: 'addToCard', threadId: shared.id, itemId: B }, who);
    const lone = await started(A, 'Alone');
    const before = await fetchThreads(scope);
    await writeItem(scope, { kind: 'delete', id: A }, ME);
    const after = await fetchThreads(scope);
    expect(after.map((t) => [t.id, t.cards.map((c) => c.itemId)])).toEqual([[shared.id, [B]]]);
    await writeItem(
      scope,
      {
        kind: 'create',
        creates: [{ id: A, key: 1, type: 'task', fields: { title: 'Card a' }, threads: before }],
      },
      ME,
    );
    const back = await fetchThreads(scope);
    expect(back.map((t) => [t.id, t.cards.map((c) => c.itemId).sort()])).toEqual([
      [shared.id, [A, B]],
      [lone.id, [A]],
    ]);
    // A write that touches no card leaves them as they are.
    expect(
      threadsAfterItemWrite(back, { kind: 'move', id: A, move: { status: 'x' } }, 'd1', []),
    ).toEqual(back);
  });
});
