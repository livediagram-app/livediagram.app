// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemWrite } from '@liveplanner/items';
import type { ItemWriteAnswer } from '@/lib/api/items';
import { replayItemQueue } from './item-replay';
import {
  confirmHeldChanges,
  forgetPlanQueues,
  heldCardCount,
  heldGroups,
  keepHeldCards,
  planQueue,
  subscribeHeldReview,
  waitingChangeCount,
  type QueuedChange,
} from './plan-queue';
import {
  HELD_TITLE_MAX,
  heldGroupHeading,
  heldMoreLabel,
  heldReason,
  heldRows,
  heldTitle,
  heldTitles,
  heldToggleLabel,
  heldWhyOf,
  heldWhyOfStored,
  isRemovalHeld,
  keepLabel,
  keptToast,
  removeLabel,
  removedToast,
  type HeldGroup,
} from './removal-held';

// docs/specs/007-editor/offline-changes.md "Held for review": a removal the server held is kept, skipped by the
// replay, sent again confirmed on Remove N Cards and dropped on Keep Cards.

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

describe('isRemovalHeld and the banner copy', () => {
  it('reads the code', () => {
    expect(isRemovalHeld(HELD)).toBe(true);
    expect(isRemovalHeld(new Error('x'))).toBe(false);
    expect(isRemovalHeld(null)).toBe(false);
  });

  it('counts cards in the title, labels and toasts', () => {
    expect(heldTitle(1)).toBe('1 card was about to be removed');
    expect(heldTitle(11)).toBe('11 cards were about to be removed');
    expect([keepLabel(1), keepLabel(2)]).toEqual(['Keep Card', 'Keep Cards']);
    expect([removeLabel(1), removeLabel(11)]).toEqual(['Remove 1 Card', 'Remove 11 Cards']);
    expect([keptToast(1), removedToast(11)]).toEqual(['Kept 1 card', 'Removed 11 cards']);
    expect(heldToggleLabel(11, false)).toBe('Show the 11 cards');
    expect(heldToggleLabel(1, false)).toBe('Show the card');
    expect(heldToggleLabel(11, true)).toBe('Hide the cards');
    expect(heldToggleLabel(1, true)).toBe('Hide the card');
  });

  it('says why by the board and reason every held card shares, else plainly', () => {
    const g = (over: Partial<HeldGroup>): HeldGroup => ({
      board: 'Sprint',
      reason: 'over-threshold',
      cards: 3,
      titles: [],
      ...over,
    });
    expect(heldReason([g({})])).toBe(
      'That’s more of Sprint than usual in one go, so we paused it. Nothing is gone yet.',
    );
    expect(heldReason([g({ reason: 'empties-board' })])).toBe(
      'That would empty Sprint, so we paused it. Nothing is gone yet.',
    );
    const plain = 'That’s more cards than usual in one go, so we paused it. Nothing is gone yet.';
    expect(heldReason([])).toBe(plain);
    expect(heldReason([g({ board: null })])).toBe(plain);
    expect(heldReason([g({ reason: null })])).toBe(plain);
    expect(heldReason([g({}), g({ board: 'Roadmap' })])).toBe(plain);
    expect(heldGroupHeading(g({}))).toBe('From Sprint');
    expect(heldGroupHeading(g({ reason: 'empties-board', board: null }))).toBe(
      'Would empty A board',
    );
  });

  it('lists up to eight titles, then how many more', () => {
    const titles = Array.from({ length: 10 }, (_, i) => (i === 0 ? '  ' : `Card ${i}`));
    const rows = heldRows({ board: null, reason: null, cards: 11, titles });
    expect(rows.titles).toHaveLength(8);
    expect(rows.titles[0]).toBe('Untitled card');
    expect(rows.more).toBe(3);
    expect(heldMoreLabel(8, 3)).toBe('and 3 more');
    expect(heldMoreLabel(0, 1)).toBe('1 card');
    expect(heldMoreLabel(0, 2)).toBe('2 cards');
    expect(heldMoreLabel(2, 0)).toBeNull();
  });

  it('reads the reason and board off a refusal, and a stored why only of its shape', () => {
    expect(heldWhyOf({ reason: 'empties-board', board: 'Sprint' })).toEqual({
      reason: 'empties-board',
      board: 'Sprint',
    });
    expect(heldWhyOf({ reason: 'nope', board: '' })).toEqual({});
    expect(heldWhyOf(null)).toEqual({});
    expect(heldWhyOfStored({ reason: 'over-threshold', titles: ['a', 3] })).toEqual({
      reason: 'over-threshold',
      titles: ['a'],
    });
    expect(heldWhyOfStored('x')).toEqual({});
    expect(heldWhyOfStored(undefined)).toEqual({});
    const long = 'x'.repeat(200);
    expect(heldTitles(['a', long])[1]).toHaveLength(HELD_TITLE_MAX);
    expect(heldTitles([long])[0]!.endsWith('…')).toBe(true);
  });
});

describe('why a removal was held', () => {
  it('keeps the reason, board and titles a replay is held for, and groups them', async () => {
    const reasoned = Object.assign(new Error('held'), {
      code: 'removal_held',
      reason: 'empties-board',
      board: 'Sprint',
    });
    const d = {
      ...deps(async () => {
        throw reasoned;
      }),
      titlesOf: (ids: readonly string[]) => ids.map((id) => `Title ${id}`),
    };
    d.queue.add(trash('a', 1));
    await replayItemQueue(d);
    expect(d.queue.changes('items')[0]).toEqual({
      ...trash('a', 1),
      held: true,
      why: { reason: 'empties-board', board: 'Sprint', titles: ['Title a'] },
    });
    // A second queue's held change with no why groups apart, as plain.
    const q2 = planQueue('p2', 'o');
    q2.add(del('z', 5));
    q2.hold(['i5']);
    expect(heldGroups()).toEqual([
      { board: 'Sprint', reason: 'empties-board', cards: 1, titles: ['Title a'] },
      { board: null, reason: null, cards: 1, titles: [] },
    ]);
    // Confirmed, it no longer carries its why.
    confirmHeldChanges();
    expect(d.queue.changes('items')[0]).toEqual({ ...trash('a', 1), confirmed: true });
    expect(heldGroups()).toEqual([]);
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

  it('sends confirmed changes alone, confirmed, on Remove N Cards', async () => {
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
