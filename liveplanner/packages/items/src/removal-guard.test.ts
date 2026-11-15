import { describe, expect, it } from 'vitest';
import type { PlanBoardOutline } from './plan-outline';
import {
  REMOVAL_GUARD_FLOOR,
  REMOVAL_GUARD_MAX,
  judgeRemoval,
  removalBoardsOf,
  removalHeldMessage,
  removalLimit,
  type RemovalBoard,
} from './removal-guard';
import { item } from './test-items';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card removals".

const outline = (over: Partial<PlanBoardOutline> = {}): PlanBoardOutline => ({
  tabId: 't1',
  tabName: 'Board Tab',
  elementId: 'b1',
  title: 'Sprint Board',
  kind: 'board',
  types: null,
  columns: [
    { status: 'todo', name: 'To Do' },
    { status: 'done', name: 'Done' },
  ],
  ...over,
});

const board = (n: number, id = 'b1'): RemovalBoard => ({
  id,
  name: id === 'b1' ? 'Sprint Board' : 'Other',
  cards: new Set(Array.from({ length: n }, (_, i) => `${id}-${i}`)),
});
const first = (n: number, id = 'b1') =>
  new Set(Array.from({ length: n }, (_, i) => `${id}-${i}`));

describe('removalLimit', () => {
  it('is the smaller of 20% and 50, never under the floor', () => {
    expect(removalLimit(0)).toBe(REMOVAL_GUARD_FLOOR);
    expect(removalLimit(30)).toBe(REMOVAL_GUARD_FLOOR);
    expect(removalLimit(100)).toBe(20);
    expect(removalLimit(249)).toBe(49);
    expect(removalLimit(1000)).toBe(REMOVAL_GUARD_MAX);
  });
});

describe('removalBoardsOf', () => {
  const todo = item({ title: 'a', status: 'todo' });
  const done = item({ title: 'b', status: 'done' }, { type: 'bug' });
  const elsewhere = item({ title: 'c', status: 'backlog' });
  const trashed = item({ title: 'd', status: 'trash' });
  const archived = item({ title: 'e', status: 'todo', archived: true });
  const items = [todo, done, elsewhere, trashed, archived];

  it('counts the live cards in its columns, of the types it takes', () => {
    const [b] = removalBoardsOf([outline()], items);
    expect([...b!.cards]).toEqual([todo.id, done.id]);
    expect(b!.name).toBe('Sprint Board');
    const [typed] = removalBoardsOf([outline({ types: ['task'] })], items);
    expect([...typed!.cards]).toEqual([todo.id]);
  });

  it('counts every live card on an All Cards board, none on an Archive board', () => {
    const boards = removalBoardsOf(
      [
        outline({ kind: 'all-cards', columns: [], title: '' }),
        outline({ kind: 'archive', elementId: 'b2' }),
      ],
      items,
    );
    expect(boards).toHaveLength(1);
    expect([...boards[0]!.cards]).toEqual([todo.id, done.id, elsewhere.id]);
    // An untitled board is named by its tab.
    expect(boards[0]!.name).toBe('Board Tab');
  });
});

describe('judgeRemoval', () => {
  it('passes a run within the limit on every board', () => {
    expect(judgeRemoval([board(100)], first(20))).toBeNull();
    expect(judgeRemoval([board(5)], first(2))).toBeNull();
    // A small board can be cleared: one or two cards.
    expect(judgeRemoval([board(2)], first(2))).toBeNull();
    // Cards no board shows (the Trash, a stale id) count for none.
    expect(judgeRemoval([board(100), board(0, 'b2')], new Set(['gone']))).toBeNull();
  });

  it('holds a run past the limit, naming the board', () => {
    expect(judgeRemoval([board(100)], first(21))).toEqual({
      reason: 'over-threshold',
      board: 'Sprint Board',
      count: 21,
      had: 100,
      limit: 20,
    });
    expect(judgeRemoval([board(1000)], first(51))?.limit).toBe(50);
    expect(judgeRemoval([board(30)], first(11))?.reason).toBe('over-threshold');
  });

  it('refuses a run that empties a board of three cards or more', () => {
    expect(judgeRemoval([board(3)], first(3))).toEqual({
      reason: 'empties-board',
      board: 'Sprint Board',
      count: 3,
      had: 3,
      limit: REMOVAL_GUARD_FLOOR,
    });
  });

  it('judges each board on its own', () => {
    const removed = new Set([...first(5, 'b1'), ...first(21, 'b2')]);
    expect(judgeRemoval([board(100, 'b1'), board(100, 'b2')], removed)?.board).toBe('Other');
  });
});

describe('removalHeldMessage', () => {
  it('says how many cards and which board', () => {
    expect(
      removalHeldMessage({
        reason: 'over-threshold',
        board: 'Sprint Board',
        count: 60,
        had: 100,
        limit: 20,
      }),
    ).toBe(
      'This would remove 60 of the 100 cards on Sprint Board at once, so it was held. Confirm it in liveplanner to go ahead.',
    );
    expect(
      removalHeldMessage({ reason: 'empties-board', board: 'Bugs', count: 4, had: 4, limit: 10 }),
    ).toBe('This would remove every card on Bugs, so it was held. Confirm it in liveplanner to go ahead.');
  });
});
