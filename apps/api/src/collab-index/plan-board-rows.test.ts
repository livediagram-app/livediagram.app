import type { Element } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS_STATUS, planBoardRowsFromElements } from './plan-board-rows';

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
        done: false,
        boardOrder: 0,
        position: 0,
      },
    ]);
  });

  it('orders boards as the tab holds them, names an untitled one, and skips junk', () => {
    const rows = planBoardRowsFromElements([
      board('junk', { columns: 'nope' }),
      { id: 'r', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 } as Element,
      board('first', { title: '  ', columns: columns('a') }),
      board('second', { title: 'Two', columns: columns('a') }),
    ]);
    expect(rows.map((r) => [r.elementId, r.boardTitle, r.boardOrder])).toEqual([
      ['first', 'Board', 0],
      ['second', 'Two', 1],
    ]);
  });
});
