import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item } from '@livediagram/items';
import { boardMoveFor } from './plan-board-moves';

let n = 0;
const item = (status: string, rank: string, extra: Item['fields'] = {}, type = 'task'): Item => {
  n += 1;
  const by = { id: 'p', name: 'P', color: '#000000' };
  return {
    id: `i${n}`,
    type,
    key: n,
    rank,
    fields: { title: `T${n}`, status, ...extra },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: by,
    updatedBy: by,
  };
};
const mapOf = (...items: Item[]) => new Map(items.map((i) => [i.id, i]));

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

// docs/specs/026-plan/plan-board.md "Moving cards".
describe('boardMoveFor', () => {
  it('moves within a board, and does nothing for a drop where the card already is', () => {
    const a = item('todo', 'a');
    const b = item('todo', 'b');
    const setup = threeColumns();
    const p = projectBoard(setup, mapOf(a, b));
    expect(boardMoveFor(setup, p, a, a.id, { status: 'todo', laneKey: '', beforeId: b.id })).toBe(
      null,
    );
    expect(
      boardMoveFor(setup, p, a, a.id, { status: 'done', laneKey: '', beforeId: null }),
    ).toEqual({ status: 'done', before: null });
  });

  it('moves a card from another board, whose status this board has no column for', () => {
    const away = item('sprint-backlog', 'a', {}, 'note');
    const setup = threeColumns();
    const p = projectBoard(setup, mapOf(away));
    expect(
      boardMoveFor(setup, p, away, away.id, { status: 'todo', laneKey: '', beforeId: null }),
    ).toEqual({ status: 'todo', before: null });
  });

  it("gives a card dropped in a row that row's field", () => {
    const sam = { id: 's', name: 'Sam', color: '#0ea5e9' };
    const mine = item('doing', 'a', { assignee: sam }, 'task');
    const loose = item('doing', 'b', {}, 'task');
    const setup = presetSetup('sprint');
    const p = projectBoard(setup, mapOf(mine, loose));
    const slot = { status: 'doing', laneKey: 'a:s', beforeId: null };
    expect(boardMoveFor(setup, p, loose, loose.id, slot)).toEqual({
      status: 'doing',
      before: null,
      set: { assignee: sam },
    });
  });
});
