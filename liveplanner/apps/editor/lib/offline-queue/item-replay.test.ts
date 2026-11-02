import { describe, expect, it, vi } from 'vitest';
import { ITEM_BULK_MAX, type ItemWrite } from '@liveplanner/items';
import { ApiError } from '@/lib/api/core';
import type { ItemWriteAnswer } from '@/lib/api/items';
import { alreadyLanded, nextItemBatch, replayItemQueue } from './item-replay';
import { PlanQueue, type QueuedChange } from './plan-queue';

// docs/specs/007-editor/offline-changes.md "Sending them", "When the server says no".

type ItemChange = Extract<QueuedChange, { store: 'items' }>;
const change = (seq: number, write: ItemWrite): ItemChange => ({
  id: `i${seq}`,
  seq,
  store: 'items',
  write,
});
const patch = (id: string, title: string, undo?: true): ItemWrite => ({
  kind: 'patch',
  id,
  patch: { set: { title } },
  ...(undo ? { undo } : {}),
});
const answer = (): ItemWriteAnswer => ({ upserts: [], removed: [], rev: 1 });

function queueOf(...changes: ItemChange[]): PlanQueue {
  const q = new PlanQueue('k', null);
  for (const c of changes) q.add(c);
  return q;
}

describe('nextItemBatch', () => {
  it('sends a lone change as it is', () => {
    const c = change(1, { kind: 'delete', id: 'a' });
    expect(nextItemBatch([c, change(2, patch('a', 'x'))], -1)).toEqual({
      ids: ['i1'],
      write: c.write,
      lastSeq: 1,
    });
    const p = change(3, patch('a', 'x'));
    expect(nextItemBatch([p], -1).write).toBe(p.write);
  });

  it('sends a run of field changes as one many-patch write, stopping at another kind or undo flag', () => {
    const run = [
      change(1, patch('a', 'one')),
      change(2, patch('b', 'two')),
      change(3, patch('a', 'three')),
      change(4, patch('c', 'undo', true)),
      change(5, patch('d', 'four')),
    ];
    expect(nextItemBatch(run, -1)).toEqual({
      ids: ['i1', 'i2', 'i3'],
      write: {
        kind: 'patches',
        patches: [
          { id: 'a', patch: { set: { title: 'one' } } },
          { id: 'b', patch: { set: { title: 'two' } } },
          { id: 'a', patch: { set: { title: 'three' } } },
        ],
      },
      lastSeq: 3,
    });
    const undos = [change(1, patch('a', 'x', true)), change(2, patch('b', 'y', true))];
    expect(nextItemBatch(undos, -1).write).toMatchObject({ kind: 'patches', undo: true });
  });

  it(`takes at most ${ITEM_BULK_MAX} changes per request`, () => {
    const run = Array.from({ length: ITEM_BULK_MAX + 5 }, (_, i) =>
      change(i + 1, patch('a', `t${i}`)),
    );
    expect(nextItemBatch(run, -1).ids).toHaveLength(ITEM_BULK_MAX);
  });

  it('sends each change alone up to `splitThrough` (a refused batch)', () => {
    const run = [
      change(1, patch('a', 'x')),
      change(2, patch('b', 'y')),
      change(3, patch('c', 'z')),
    ];
    expect(nextItemBatch(run, 2).ids).toEqual(['i1']);
    expect(nextItemBatch(run.slice(2), 2).ids).toEqual(['i3']);
  });
});

describe('alreadyLanded', () => {
  it('is a create the server already has, or a delete of a card already gone', () => {
    const create: ItemWrite = { kind: 'create', creates: [{ id: 'a', type: 'task', fields: {} }] };
    expect(alreadyLanded(create, new ApiError('test', 409, 'item_exists'))).toBe(true);
    expect(alreadyLanded(create, new ApiError('test', 400, 'items_full'))).toBe(false);
    const del: ItemWrite = { kind: 'delete', id: 'a' };
    expect(alreadyLanded(del, new ApiError('test', 404, 'item_not_found'))).toBe(true);
    expect(alreadyLanded(del, new ApiError('test', 404, null))).toBe(true);
    expect(alreadyLanded(del, new ApiError('test', 403, null))).toBe(false);
    expect(alreadyLanded(patch('a', 'x'), new ApiError('test', 404, 'item_not_found'))).toBe(false);
    expect(alreadyLanded(del, null)).toBe(false);
  });
});

describe('replayItemQueue', () => {
  it('sends everything in order, folds each answer in, and empties the queue', async () => {
    const queue = queueOf(
      change(1, { kind: 'create', creates: [{ id: 'n', type: 'task', fields: { title: 'N' } }] }),
      change(2, patch('a', 'x')),
      change(3, patch('b', 'y')),
      change(4, { kind: 'move', id: 'a', move: { status: 'done' } }),
    );
    const send = vi.fn(async (_w: ItemWrite) => answer());
    const landed = vi.fn();
    const refused = vi.fn();
    expect(await replayItemQueue({ queue, send, landed, refused })).toEqual({
      outcome: 'done',
      sent: 4,
    });
    expect(send.mock.calls.map(([w]) => w.kind)).toEqual(['create', 'patches', 'move']);
    expect(landed).toHaveBeenCalledTimes(3);
    expect(refused).not.toHaveBeenCalled();
    expect(queue.count()).toBe(0);
  });

  it('stops on a request with no answer, keeping it and everything after it', async () => {
    const queue = queueOf(
      change(1, { kind: 'delete', id: 'a' }),
      change(2, { kind: 'delete', id: 'b' }),
    );
    const send = vi
      .fn()
      .mockResolvedValueOnce(answer())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await replayItemQueue({ queue, send, landed: vi.fn(), refused: vi.fn() })).toEqual({
      outcome: 'stalled',
      sent: 1,
    });
    expect(queue.changes('items').map((c) => c.id)).toEqual(['i2']);
  });

  it('takes back only the change the server refuses: a refused batch goes again one by one', async () => {
    const queue = queueOf(
      change(1, patch('a', 'x')),
      change(2, patch('gone', 'y')),
      change(3, patch('b', 'z')),
    );
    const refusal = new ApiError('test', 404, 'item_not_found');
    const partly = Object.assign(new ApiError('test', 400, 'x'), { landed: answer() });
    const send = vi.fn(async (w: ItemWrite) => {
      if (w.kind === 'patches') throw partly;
      if (w.kind === 'patch' && w.id === 'gone') throw refusal;
      return answer();
    });
    const landed = vi.fn();
    const refused = vi.fn();
    expect(await replayItemQueue({ queue, send, landed, refused })).toEqual({
      outcome: 'done',
      sent: 3,
    });
    expect(send).toHaveBeenCalledTimes(4);
    // The batch's landed part, then the two that landed alone.
    expect(landed).toHaveBeenCalledTimes(3);
    expect(refused).toHaveBeenCalledWith(patch('gone', 'y'), refusal);
    expect(queue.count()).toBe(0);
  });

  it('drops a change the server already has without telling anyone', async () => {
    const queue = queueOf(change(1, { kind: 'delete', id: 'a' }));
    const refused = vi.fn();
    const send = vi.fn().mockRejectedValue(new ApiError('test', 404, 'item_not_found'));
    expect(await replayItemQueue({ queue, send, landed: vi.fn(), refused })).toEqual({
      outcome: 'done',
      sent: 1,
    });
    expect(refused).not.toHaveBeenCalled();
  });

  it('has nothing to do on an empty queue', async () => {
    const send = vi.fn();
    expect(
      await replayItemQueue({ queue: queueOf(), send, landed: vi.fn(), refused: vi.fn() }),
    ).toEqual({
      outcome: 'done',
      sent: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
