import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item } from '@livediagram/items';
import { boardMoveFor, scopeRefusal } from './plan-board-moves';

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

// docs/specs/025-plan/plan-board.md "Moving cards".
describe('boardMoveFor', () => {
  it('moves within a board, and does nothing for a drop where the card already is', () => {
    const a = item('todo', 'a');
    const b = item('todo', 'b');
    const setup = presetSetup('blank');
    const p = projectBoard(setup, mapOf(a, b));
    expect(boardMoveFor(setup, p, a, a.id, { status: 'todo', laneKey: '', beforeId: b.id })).toBe(
      null,
    );
    expect(
      boardMoveFor(setup, p, a, a.id, { status: 'done', laneKey: '', beforeId: null }),
    ).toEqual({ status: 'done', before: null });
  });

  it('moves a card from another board even into the column of its own status', () => {
    const away = item('todo', 'a', {}, 'bug');
    const setup = { ...presetSetup('blank'), scope: { types: ['task'] } };
    const p = projectBoard(setup, mapOf(away));
    expect(
      boardMoveFor(setup, p, away, away.id, { status: 'todo', laneKey: '', beforeId: null }),
    ).toEqual({ status: 'todo', before: null });
  });

  it("gives a card dropped in a row that row's field", () => {
    const sam = { id: 's', name: 'Sam', color: '#0ea5e9' };
    const mine = item('doing', 'a', { assignee: sam }, 'story');
    const loose = item('doing', 'b', {}, 'story');
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

describe('scopeRefusal', () => {
  it('names the types or the label a board shows', () => {
    expect(scopeRefusal({ types: ['bug'] })).toBe('This board shows Bug items only');
    expect(scopeRefusal({ types: ['story', 'task', 'bug'] })).toBe(
      'This board shows Story, Task and Bug items only',
    );
    expect(scopeRefusal({ label: 'ops' })).toBe('This board shows items labelled “ops” only');
    expect(scopeRefusal({})).toBe('This board can’t take that card');
  });
});
