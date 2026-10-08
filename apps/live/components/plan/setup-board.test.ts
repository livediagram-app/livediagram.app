import { describe, expect, it } from 'vitest';
import { PLAN_COLUMNS_MAX, type PlanBoardSetup } from '@livediagram/items';
import { columnFromName, setUpBoard, type SetupColumn } from './setup-board';

// docs/specs/026-plan/plan-board.md "Setup Board".
const empty: PlanBoardSetup = {
  title: 'Board',
  columns: [],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
};
const names = new Map([
  ['todo', 'To Do'],
  ['done', 'Done'],
]);
const ALL = ['project', 'task', 'note'];

describe('setUpBoard', () => {
  it('makes the chosen columns in order, existing statuses kept and new ones their own', () => {
    const cols: SetupColumn[] = [
      { kind: 'existing', status: 'todo', name: 'To Do' },
      { kind: 'new', name: 'Waiting' },
      { kind: 'existing', status: 'done', name: 'Done' },
    ];
    const next = setUpBoard(empty, cols, null, ALL, () => 0);
    expect(next.columns.map((c) => c.name)).toEqual(['To Do', 'Waiting', 'Done']);
    expect(next.columns[0]!.status).toBe('todo');
    expect(next.columns[1]!.status).toMatch(/^waiting~/);
    expect(next.addTypes).toBeUndefined();
  });

  it('keeps a chosen few card types, and every type as none named', () => {
    const cols: SetupColumn[] = [{ kind: 'new', name: 'Ideas' }];
    expect(setUpBoard(empty, cols, ['note', 'task'], ALL).addTypes).toEqual(['task', 'note']);
    expect(setUpBoard(empty, cols, ALL, ALL).addTypes).toBeUndefined();
    expect(setUpBoard({ ...empty, addTypes: ['x'] }, cols, ALL, ALL).addTypes).toBeUndefined();
  });

  it('stops at the column limit', () => {
    const many = Array.from({ length: PLAN_COLUMNS_MAX + 3 }, (_, i) => ({
      kind: 'new' as const,
      name: `Stage ${i}`,
    }));
    expect(setUpBoard(empty, many, null, ALL).columns).toHaveLength(PLAN_COLUMNS_MAX);
  });
});

describe('columnFromName', () => {
  it('uses an existing status of that name, else makes a new column', () => {
    expect(columnFromName(' to-do ', [], names)).toEqual({
      kind: 'existing',
      status: 'todo',
      name: 'To Do',
    });
    expect(columnFromName('Blocked', [], names)).toEqual({ kind: 'new', name: 'Blocked' });
  });

  it('refuses an empty name or one already chosen', () => {
    expect(columnFromName('  ', [], names)).toBeNull();
    const chosen: SetupColumn[] = [
      { kind: 'existing', status: 'todo', name: 'To Do' },
      { kind: 'new', name: 'Blocked' },
    ];
    expect(columnFromName('To Do', chosen, names)).toBeNull();
    expect(columnFromName('blocked', chosen, names)).toBeNull();
  });
});

describe('Setup Board on a board that has columns', () => {
  it('keeps a kept column’s settings, makes the new ones, drops the rest, and starts from the board', async () => {
    const { setupFromBoard } = await import('./setup-board');
    const board: PlanBoardSetup = {
      ...empty,
      doneColumnId: 'c-done',
      columns: [
        { id: 'c-todo', status: 'todo', name: 'To Do', wipLimit: 3, color: '#2563eb' },
        { id: 'c-done', status: 'done', name: 'Done' },
      ],
      addTypes: ['task'],
    };
    const start = setupFromBoard(board, ['task']);
    expect(start.columns).toEqual([
      { kind: 'existing', status: 'todo', name: 'To Do' },
      { kind: 'existing', status: 'done', name: 'Done' },
    ]);
    const next = setUpBoard(
      board,
      [{ kind: 'new', name: 'Waiting' }, start.columns[0]!],
      ['task', 'note'],
      ALL,
      () => 0,
    );
    expect(next.columns.map((c) => c.name)).toEqual(['Waiting', 'To Do']);
    expect(next.columns[1]).toEqual(board.columns[0]);
    expect(next.doneColumnId).toBeUndefined();
    expect(next.addTypes).toEqual(['task', 'note']);
  });
});
