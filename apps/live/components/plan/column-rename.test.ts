import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from '@livediagram/items';
import { addFirstColumn } from './board-setup-edits';
import { columnRename, pickableStatuses } from './column-status-picks';

// docs/specs/026-plan/plan-board.md "The board set-up": one name, one status, when a column is named.
const setup = {
  columns: [
    { id: 'a', status: 'new~x1', name: 'New Column' },
    { id: 'b', status: 'doing', name: 'Doing' },
  ],
} as unknown as PlanBoardSetup;
const names = new Map([
  ['todo', 'To Do'],
  ['doing', 'Doing'],
  ['new~x1', 'New Column'],
]);

describe('renaming a column', () => {
  it('renames when no other status has the name', () => {
    expect(columnRename(setup, 'a', 'Review', names, false)).toEqual({ kind: 'rename' });
  });

  it('switches an empty column to the status that has the name', () => {
    expect(columnRename(setup, 'a', 'todo', names, false)).toEqual({
      kind: 'reuse',
      status: 'todo',
      name: 'To Do',
    });
  });

  it('refuses when the column holds cards, or the board already shows that status', () => {
    expect(columnRename(setup, 'a', 'To Do', names, true)).toEqual({
      kind: 'clash',
      name: 'To Do',
    });
    expect(columnRename(setup, 'a', 'doing', names, false)).toEqual({
      kind: 'clash',
      name: 'Doing',
    });
  });
});

describe('a board’s first column', () => {
  it('takes the status a name already belongs to', () => {
    const empty = { columns: [] } as unknown as PlanBoardSetup;
    expect(addFirstColumn(empty, 'to do', names)!.columns[0]).toMatchObject({
      status: 'todo',
      name: 'To Do',
    });
    expect(addFirstColumn(empty, 'Fresh', names)!.columns[0]!.status).toMatch(/^fresh~/);
  });
});

describe('the statuses a column can be made for', () => {
  const PERSON = { id: 'p', name: 'A', color: '#000' };
  const card = (status: string) =>
    ({
      id: `i-${status}`,
      type: 'task',
      key: 1,
      rank: 'a',
      fields: { title: 'T', status },
      rev: 1,
      createdAt: 0,
      updatedAt: 0,
      createdBy: PERSON,
      updatedBy: PERSON,
    }) as never;

  it('adds the statuses cards are in that no board names, never the Trash', () => {
    const boards = new Map([['todo', 'To Do']]);
    const picks = pickableStatuses(boards, [card('todo'), card('in-review~ab12'), card('trash')]);
    expect([...picks]).toEqual([
      ['todo', 'To Do'],
      ['in-review~ab12', 'In Review'],
    ]);
    expect(pickableStatuses(boards, [card('todo')])).toBe(boards);
  });
});
