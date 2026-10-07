import { describe, expect, it } from 'vitest';
import { freshBoardSetup } from './presets';
import { statusKey, statusNamed } from './status-names';

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
