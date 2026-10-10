import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { newTypeForBoard, withTypeOnBoard } from './useTypeForBoard';

// docs/specs/026-plan/plan-board.md "Add New Card Type".
const board = (id: string, addTypes?: string[]): Element =>
  ({
    ...createShape('plan-board', 0, 0),
    id,
    planBoard: {
      title: 'Retro',
      columns: [{ id: 'c1', status: 'went-well', name: 'Went Well' }],
      swimlaneBy: 'none',
      cardFields: [],
      hideWriting: false,
      ...(addTypes ? { addTypes } : {}),
    },
  }) as Element;

describe('a type made from a board', () => {
  it('starts with only the board’s statuses on', () => {
    const t = newTypeForBoard({ boardId: 'b', statuses: ['went-well', 'improve'] }, [
      'todo',
      'went-well',
      'improve',
      'done',
    ]);
    expect(t.excludedStatuses).toEqual(['todo', 'done']);
    expect(t.label).toBe('');
    expect(
      newTypeForBoard({ boardId: 'b', statuses: ['a'] }, ['a']).excludedStatuses,
    ).toBeUndefined();
  });

  it('joins a board that takes chosen types, once', () => {
    const els = [board('b', ['note']), board('other', ['note'])];
    const next = withTypeOnBoard(els, 'b', 'kudos');
    expect((next[0] as { planBoard: { addTypes: string[] } }).planBoard.addTypes).toEqual([
      'note',
      'kudos',
    ]);
    expect(next[1]).toBe(els[1]);
    expect(withTypeOnBoard(next, 'b', 'kudos')).toBe(next);
  });

  it('leaves a board that takes every type alone', () => {
    const els = [board('b')];
    expect(withTypeOnBoard(els, 'b', 'kudos')).toBe(els);
  });
});
