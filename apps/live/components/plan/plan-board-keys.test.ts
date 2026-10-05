import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item } from '@livediagram/items';
import { planBoardKey } from './plan-board-keys';

let n = 0;
const item = (status: string, title: string, rank: string): Item => {
  n += 1;
  const by = { id: 'p', name: 'P', color: '#000000' };
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank,
    fields: { title, status },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: by,
    updatedBy: by,
  };
};

// docs/specs/025-plan/plan-board.md "Keyboard".
// A board of To do, In progress and Done (the Blank board itself starts with none).
const threeColumns = () => ({
  ...presetSetup('blank'),
  columns: [
    { id: 'todo', status: 'todo', name: 'To do' },
    { id: 'doing', status: 'doing', name: 'In progress' },
    { id: 'done', status: 'done', name: 'Done' },
  ],
  doneColumnId: 'done',
});

describe('planBoardKey', () => {
  const a = item('todo', 'A', 'a');
  const b = item('todo', 'B', 'b');
  const c = item('done', 'C', 'a');
  const p = projectBoard(threeColumns(), new Map([a, b, c].map((i) => [i.id, i])));

  it('moves focus with the arrows, skipping empty columns', () => {
    expect(planBoardKey(p, a.id, 'ArrowDown', false, true)).toEqual({
      kind: 'focus',
      itemId: b.id,
    });
    expect(planBoardKey(p, a.id, 'ArrowUp', false, true)).toBeNull();
    expect(planBoardKey(p, b.id, 'ArrowRight', false, true)).toEqual({
      kind: 'focus',
      itemId: c.id,
    });
    expect(planBoardKey(p, c.id, 'ArrowLeft', false, true)).toEqual({
      kind: 'focus',
      itemId: a.id,
    });
    expect(planBoardKey(p, c.id, 'ArrowRight', false, true)).toBeNull();
  });

  it('moves the card with Shift and says where it went', () => {
    expect(planBoardKey(p, a.id, 'ArrowRight', true, true)).toEqual({
      kind: 'move',
      move: { status: 'doing', before: null },
      announce: '#' + a.key + ' A moved to In progress, position 1 of 1',
    });
    expect(planBoardKey(p, a.id, 'ArrowDown', true, true)).toEqual({
      kind: 'move',
      move: { after: b.id },
      announce: '#' + a.key + ' A moved to position 2 of 2',
    });
    expect(planBoardKey(p, b.id, 'ArrowUp', true, true)).toMatchObject({ move: { before: a.id } });
    expect(planBoardKey(p, a.id, 'ArrowLeft', true, true)).toBeNull();
    expect(planBoardKey(p, a.id, 'ArrowUp', true, true)).toBeNull();
    expect(planBoardKey(p, b.id, 'ArrowRight', true, false)).toEqual({
      kind: 'focus',
      itemId: c.id,
    });
    expect(planBoardKey(p, a.id, 'x', true, true)).toBeNull();
  });

  it('opens, deletes and adds', () => {
    expect(planBoardKey(p, a.id, 'Enter', false, false)).toEqual({ kind: 'open' });
    expect(planBoardKey(p, a.id, 'Delete', false, true)).toEqual({ kind: 'delete' });
    expect(planBoardKey(p, a.id, 'Delete', false, false)).toBeNull();
    expect(planBoardKey(p, a.id, 'n', false, true)).toEqual({
      kind: 'add',
      status: 'todo',
      laneKey: '',
    });
    expect(planBoardKey(p, 'missing', 'Enter', false, true)).toBeNull();
    expect(planBoardKey(p, a.id, 'q', false, true)).toBeNull();
  });
});
