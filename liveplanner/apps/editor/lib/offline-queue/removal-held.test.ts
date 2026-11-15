// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemWrite } from '@liveplanner/items';
import type { ItemWriteAnswer } from '@/lib/api/items';
import { replayItemQueue } from './item-replay';
import {
  confirmHeldChanges,
  forgetPlanQueues,
  heldCardCount,
  keepHeldCards,
  planQueue,
  subscribeHeldReview,
  waitingChangeCount,
  type QueuedChange,
} from './plan-queue';
import { heldCopy, isRemovalHeld } from './removal-held';

// docs/specs/007-editor/offline-changes.md "Held for review": a removal the server held is kept, skipped by the
// replay, sent again confirmed on Remove Anyway and dropped on Keep Cards.

afterEach(() => {
  localStorage.clear();
  forgetPlanQueues();
});

const HELD = Object.assign(new Error('held'), { code: 'removal_held', status: 409 });
const ok: ItemWriteAnswer = { upserts: [], removed: [], rev: 1 };
const del = (id: string, seq: number, extra: Partial<QueuedChange> = {}): QueuedChange =>
  ({ id: `i${seq}`, seq, store: 'items', write: { kind: 'delete', id }, ...extra }) as QueuedChange;
const trash = (id: string, seq: number): QueuedChange => ({
  id: `i${seq}`,
  seq,
  store: 'items',
  write: { kind: 'patch', id, patch: { set: { status: 'trash' } } },
});

function deps(send: (w: ItemWrite, o?: { confirmRemoval?: boolean }) => Promise<ItemWriteAnswer>) {
  return {
    queue: planQueue('p', 'o'),
    send: vi.fn(send),
    landed: vi.fn(),
    refused: vi.fn(),
  };
}

describe('isRemovalHeld and heldCopy', () => {
  it('reads the code and counts the removals', () => {
    expect(isRemovalHeld(HELD)).toBe(true);
    expect(isRemovalHeld(new Error('x'))).toBe(false);
    expect(isRemovalHeld(null)).toBe(false);
    expect(heldCopy(1)).toBe(
      '1 card removal is held: it would take too many cards off a board, or empty it.',
    );
    expect(heldCopy(3)).toBe(
      '3 card removals are held: they would take too many cards off a board, or empty it.',
    );
  });
});

describe('a held removal in the replay', () => {
  it('is kept and skipped, while the changes behind it are sent', async () => {
    const d = deps(async (w) => {
      if (w.kind === 'delete' && w.id === 'a') throw HELD;
      return ok;
    });
    d.queue.add(del('a', 1));
    d.queue.add(del('b', 2));
    expect(await replayItemQueue(d)).toEqual({ outcome: 'done', sent: 1 });
    expect(d.refused).not.toHaveBeenCalled();
    expect(d.queue.changes('items')).toEqual([{ ...del('a', 1), held: true }]);
    expect(d.queue.heldCount()).toBe(1);
    expect(d.queue.waiting('items')).toBe(0);
    expect(heldCardCount()).toBe(1);
    expect(waitingChangeCount()).toBe(0);
    // A second replay sends nothing: the held change waits for the person.
    expect(await replayItemQueue(d)).toEqual({ outcome: 'done', sent: 0 });
    expect(d.send).toHaveBeenCalledTimes(2);
  });

  it('splits a held batch, keeping only the changes the server holds', async () => {
    const d = deps(async (w) => {
      if (w.kind === 'patches' || (w.kind === 'patch' && w.id !== 'a')) throw HELD;
      return ok;
    });
    d.queue.add(trash('a', 1));
    d.queue.add(trash('b', 2));
    d.queue.add(trash('c', 3));
    expect(await replayItemQueue(d)).toEqual({ outcome: 'done', sent: 1 });
    expect(d.queue.changes('items').map((c) => c.id)).toEqual(['i2', 'i3']);
    expect(d.queue.heldCount()).toBe(2);
  });

  it('sends confirmed changes alone, confirmed, on Remove Anyway', async () => {
    const reviews: string[] = [];
    subscribeHeldReview((r) => reviews.push(r));
    const d = deps(async () => ok);
    d.queue.add(trash('a', 1));
    d.queue.add(trash('b', 2));
    d.queue.hold(['i1', 'i2']);
    d.queue.add(trash('c', 3));
    confirmHeldChanges();
    expect(reviews).toEqual(['confirmed']);
    expect(heldCardCount()).toBe(0);
    expect(d.queue.changes('items')[0]).toEqual({ ...trash('a', 1), confirmed: true });
    expect(await replayItemQueue(d)).toEqual({ outcome: 'done', sent: 3 });
    expect(d.send.mock.calls.map(([w, o]) => [w.kind, o])).toEqual([
      ['patch', { confirmRemoval: true }],
      ['patch', { confirmRemoval: true }],
      ['patch', undefined],
    ]);
    // Nothing held: nothing to tell.
    confirmHeldChanges();
    expect(reviews).toEqual(['confirmed']);
  });

  it('drops the held changes on Keep Cards, keeping the rest', () => {
    const reviews: string[] = [];
    const stop = subscribeHeldReview((r) => reviews.push(r));
    const q = planQueue('p', 'o');
    q.add(del('a', 1));
    q.add(del('b', 2));
    q.hold(['i1']);
    // Holding again changes nothing; a held change confirmed is held again when the server holds it once more.
    q.hold(['i1']);
    keepHeldCards();
    expect(reviews).toEqual(['kept']);
    expect(q.changes('items').map((c) => c.id)).toEqual(['i2']);
    expect(heldCardCount()).toBe(0);
    stop();
    keepHeldCards();
    expect(reviews).toEqual(['kept']);
  });

  it('counts the cards a held change names, and tells Keep Cards which', () => {
    const told: (readonly string[])[] = [];
    subscribeHeldReview((_r, cards) => told.push(cards));
    const q = planQueue('p', 'o');
    q.add({
      id: 'i1',
      seq: 1,
      store: 'items',
      write: {
        kind: 'patches',
        patches: ['a', 'b', 'c'].map((id) => ({ id, patch: { set: { status: 'trash' } } })),
      },
    });
    q.add(del('d', 2));
    q.hold(['i1', 'i2']);
    expect(q.heldCount()).toBe(2);
    expect(q.heldCardCount()).toBe(4);
    expect(heldCardCount()).toBe(4);
    keepHeldCards();
    expect(told).toEqual([['a', 'b', 'c', 'd']]);
    expect(heldCardCount()).toBe(0);
  });

  it('keeps the held mark across a reload', () => {
    const q = planQueue('p', 'o');
    q.add(del('a', 1, { held: true }));
    forgetPlanQueues();
    const again = planQueue('p', 'o');
    expect(again.heldCount()).toBe(1);
    expect(heldCardCount()).toBe(1);
    expect(again.waiting()).toBe(0);
    expect(again.waiting('sheets')).toBe(0);
  });
});
