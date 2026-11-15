import type { Element } from './index';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS_STATUS, cardPlacesOf, planBoardRowsFromElements } from './plan-board-rows';

// The board half of the Inbox's index (docs/specs/013-workspace/inbox.md §2.4).

const board = (id: string, planBoard: unknown) =>
  ({
    id,
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    planBoard,
  }) as Element;

const columns = (...statuses: string[]) =>
  statuses.map((s) => ({ id: `c-${s}`, status: s, name: s }));

describe('planBoardRowsFromElements', () => {
  it('flags the done column and every column after it as Done', () => {
    const rows = planBoardRowsFromElements([
      board('b', {
        title: 'Sprint',
        columns: columns('todo', 'done', 'shipped'),
        doneColumnId: 'c-done',
      }),
    ]);
    expect(rows.map((r) => [r.status, r.done, r.position, r.boardTitle])).toEqual([
      ['todo', false, 0, 'Sprint'],
      ['done', true, 1, 'Sprint'],
      ['shipped', true, 2, 'Sprint'],
    ]);
  });

  // docs/specs/026-plan/plan-board.md "Done columns": flagged columns, and unflagged ones by their names.
  it('flags each column that counts as done', () => {
    const rows = planBoardRowsFromElements([
      board('b', {
        title: 'Bugs',
        columns: [
          { id: 'a', status: 'new', name: 'New' },
          { id: 'b', status: 'live', name: 'Live', done: true },
          { id: 'c', status: 'parked', name: 'Parked' },
          { id: 'd', status: 'cancelled', name: 'Cancelled' },
        ],
      }),
    ]);
    expect(rows.map((r) => r.done)).toEqual([false, true, false, true]);
  });

  it('marks nothing Done on a board with no done column', () => {
    const rows = planBoardRowsFromElements([
      board('b', { title: 'Ideas', columns: columns('new', 'old') }),
    ]);
    expect(rows.map((r) => r.done)).toEqual([false, false]);
  });

  it('writes one never-Done row for an All Cards board and none for an Archive board', () => {
    const rows = planBoardRowsFromElements([
      board('all', { title: 'All', allCards: true, columns: columns('x') }),
      board('arch', { title: 'Archive', archive: true, columns: columns('archived') }),
    ]);
    expect(rows).toEqual([
      {
        elementId: 'all',
        boardTitle: 'All',
        status: ALL_CARDS_STATUS,
        name: '',
        done: false,
        boardOrder: 0,
        position: 0,
      },
    ]);
  });

  it('orders boards as the tab holds them, names an untitled one, and skips junk', () => {
    const rows = planBoardRowsFromElements([
      board('junk', { columns: 'nope' }),
      { id: 'r', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
      board('first', { title: '  ', columns: columns('a') }),
      board('second', { title: 'Two', columns: columns('a') }),
    ]);
    expect(rows.map((r) => [r.elementId, r.boardTitle, r.boardOrder])).toEqual([
      ['first', 'Board', 0],
      ['second', 'Two', 1],
    ]);
  });
});

describe('cardPlacesOf', () => {
  const tabs = [
    {
      id: 't1',
      name: 'Ideas',
      elements: [board('all', { title: 'All', allCards: true, columns: columns('x') })],
    },
    {
      id: 't2',
      name: 'Sprint',
      elements: [
        board('b', { title: 'Sprint', columns: columns('todo', 'done'), doneColumnId: 'c-done' }),
      ],
    },
  ];

  it('opens a card on the board holding its status, else an All Cards board, else none', () => {
    const places = cardPlacesOf(tabs);
    expect(places.boardFor('todo')).toEqual({
      tabId: 't2',
      tabName: 'Sprint',
      elementId: 'b',
      title: 'Sprint',
    });
    expect(places.boardFor('other')?.elementId).toBe('all');
    expect(places.boardFor(undefined)?.elementId).toBe('all');
    expect(cardPlacesOf([]).boardFor('todo')).toBeNull();
  });

  it('knows which statuses are done', () => {
    const places = cardPlacesOf(tabs);
    expect([places.isDone('done'), places.isDone('todo'), places.isDone(undefined)]).toEqual([
      true,
      false,
      false,
    ]);
  });

  // The Inbox's status chip: the column holding the card's status on the board it opens on, as it is now.
  it('names the column holding a status, with its colour and whether it is done; none when no column does', () => {
    const coloured = [
      ...tabs,
      {
        id: 't3',
        name: 'Bugs',
        elements: [
          board('bugs', {
            title: 'Bugs',
            columns: [
              { id: 'n', status: 'new', name: 'New Bugs', color: '#f97316' },
              { id: 'f', status: 'fixed', name: 'Fixed', done: true },
            ],
          }),
        ],
      },
    ];
    const places = cardPlacesOf(coloured);
    expect(places.columnFor('new')).toEqual({ name: 'New Bugs', color: '#f97316', done: false });
    expect(places.columnFor('fixed')).toEqual({ name: 'Fixed', done: true });
    expect(places.columnFor('todo')).toEqual({ name: 'todo', done: false });
    expect(places.columnFor('done')).toEqual({ name: 'done', done: true });
    // On an All Cards board, a deleted column's status, no status, no board: no column.
    expect(places.columnFor('gone')).toBeNull();
    expect(places.columnFor(undefined)).toBeNull();
    expect(cardPlacesOf([]).columnFor('todo')).toBeNull();
  });

  // A calendar feed's Board option (Work Tracker 993): two boards sharing a status (the Kanban and To-do list
  // templates both use todo~ and done~) each show the card, not only the one it opens on.
  it('says whether a board shows a card, by its statuses, All Cards and its card types', () => {
    const shared = [
      ...tabs,
      {
        id: 't4',
        name: 'Kanban',
        elements: [board('k', { title: 'Kanban', columns: columns('todo') })],
      },
      {
        id: 't5',
        name: 'Bugs',
        elements: [
          board('typed', { title: 'Bugs', columns: columns('todo'), addTypes: ['bug'] }),
          board('archive', { title: 'Archive', archive: true, columns: columns('todo') }),
        ],
      },
    ];
    const places = cardPlacesOf(shared);
    expect(places.boardFor('todo')?.elementId).toBe('b');
    expect(places.shows('b', 'todo', 'task')).toBe(true);
    expect(places.shows('k', 'todo', 'task')).toBe(true);
    expect(places.shows('k', 'done', 'task')).toBe(false);
    expect(places.shows('k', undefined, 'task')).toBe(false);
    expect(places.shows('all', 'anything', 'task')).toBe(true);
    expect(places.shows('typed', 'todo', 'bug')).toBe(true);
    expect(places.shows('typed', 'todo', 'task')).toBe(false);
    // With the catalogue: a board whose every named type is gone shows every type again.
    expect(places.shows('typed', 'todo', 'task', [{ id: 'task' }])).toBe(true);
    expect(places.shows('archive', 'todo', 'task')).toBe(false);
    expect(places.shows('missing', 'todo', 'task')).toBe(false);
    expect(places.placeOn('k', 'todo')).toEqual({ title: 'Kanban', column: 'todo' });
    expect(places.placeOn('k', 'done')).toEqual({ title: 'Kanban', column: null });
    expect(places.placeOn('all', 'todo')).toEqual({ title: 'All', column: null });
    expect(places.placeOn('k', undefined)).toEqual({ title: 'Kanban', column: null });
    expect(places.placeOn('missing', 'todo')).toBeNull();
  });
});
