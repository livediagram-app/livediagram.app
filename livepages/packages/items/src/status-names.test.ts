import { describe, expect, it } from 'vitest';
import { freshBoardSetup, presetSetup, statusColumn } from './presets';
import {
  duplicateStatuses,
  mergeBoardStatuses,
  mergedStatusPatches,
  statusKey,
  statusNamed,
} from './status-names';
import { item } from './test-items';

// docs/specs/026-plan/plan-board.md "The board set-up": one name, one status.
describe('status names', () => {
  it('compare case, spacing and punctuation aside', () => {
    expect(statusKey('To do')).toBe(statusKey('TO  DO'));
    expect(statusKey('to-do')).toBe(statusKey('Todo'));
    expect(statusKey('')).toBe('');
  });

  it('find the status a name already belongs to', () => {
    const names: [string, string][] = [
      ['todo~a1', 'To Do'],
      ['done', 'Done'],
    ];
    expect(statusNamed('todo', names)).toEqual({ status: 'todo~a1', name: 'To Do' });
    expect(statusNamed('Doing', names)).toBeUndefined();
    expect(statusNamed('  ', names)).toBeUndefined();
  });
});

describe('a placed board', () => {
  const random = () => 0.5;

  it('takes the statuses the document already has by name, and its own for the rest', () => {
    const board = freshBoardSetup('kanban', random, [['todo~zz', 'Todo']]);
    const todo = board.columns.find((c) => c.name === 'To Do')!;
    expect(todo.status).toBe('todo~zz');
    for (const c of board.columns.filter((c) => c.name !== 'To Do')) expect(c.status).toMatch(/~/);
  });

  it('starts with statuses of its own when nothing matches', () => {
    const board = freshBoardSetup('kanban', random);
    expect(new Set(board.columns.map((c) => c.status)).size).toBe(board.columns.length);
    expect(board.columns.every((c) => c.status.includes('~'))).toBe(true);
  });
});

// docs/specs/026-plan/plan-board.md "One name, one state": a document's duplicate states merge into the first.
describe('merging duplicate states', () => {
  const names: [string, string][] = [
    ['todo', 'To Do'],
    ['done', 'Done'],
    ['todo~ab12', 'to-do'],
    ['done~cd34', 'DONE'],
    ['doing', 'Doing'],
  ];
  const merged = duplicateStatuses(names);

  it('maps each later state of a name to the first', () => {
    expect([...merged]).toEqual([
      ['todo~ab12', 'todo'],
      ['done~cd34', 'done'],
    ]);
    expect(
      duplicateStatuses([
        ['a', ''],
        ['b', ''],
      ]).size,
    ).toBe(0);
  });

  it('takes a board to the kept states, dropping a column a kept one already holds', () => {
    const setup = {
      ...presetSetup('kanban'),
      columns: [
        statusColumn('todo', 'To Do'),
        statusColumn('todo~ab12', 'to-do'),
        statusColumn('done~cd34', 'DONE', { wipLimit: 2 }),
      ],
    };
    const next = mergeBoardStatuses(setup, merged);
    expect(next.columns.map((c) => [c.status, c.name])).toEqual([
      ['todo', 'To Do'],
      ['done', 'DONE'],
    ]);
    const untouched = { ...presetSetup('kanban'), columns: [statusColumn('doing', 'Doing')] };
    expect(mergeBoardStatuses(untouched, merged)).toBe(untouched);
  });

  it('moves cards, and where a trashed card goes back to, onto the kept states', () => {
    const cards = [
      item({ title: 'A', status: 'todo~ab12' }, { id: 'a' }),
      item({ title: 'B', status: 'trash', trashedFrom: 'done~cd34' }, { id: 'b' }),
      item({ title: 'C', status: 'doing' }, { id: 'c' }),
    ];
    expect(mergedStatusPatches(cards, merged)).toEqual([
      { id: 'a', patch: { set: { status: 'todo' } } },
      { id: 'b', patch: { set: { trashedFrom: 'done' } } },
    ]);
  });
});
