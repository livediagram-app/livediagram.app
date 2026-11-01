import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item } from '@liveplanner/items';
import {
  NO_SELECTION,
  groupColumnMoves,
  rangeInColumn,
  selectRange,
  selectionCountLabel,
  selectionOrder,
  selectionShown,
  toggleCard,
} from './board-selection';

// docs/specs/026-plan/plan-board.md "Several cards at once".
let n = 0;
const item = (status: string, rank: string): Item => {
  n += 1;
  const by = { id: 'p', name: 'P', color: '#000000' };
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank,
    fields: { title: `T${n}`, status },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: by,
    updatedBy: by,
  };
};
const setup = {
  ...presetSetup('blank'),
  columns: [
    { id: 'todo', status: 'todo', name: 'To do' },
    { id: 'doing', status: 'doing', name: 'Doing' },
    { id: 'done', status: 'done', name: 'Done' },
  ],
};
const a = item('todo', 'a');
const b = item('todo', 'b');
const c = item('todo', 'c');
const d = item('doing', 'a');
const e = item('done', 'a');
const map = new Map([a, b, c, d, e].map((i) => [i.id, i]));
const p = projectBoard(setup, map);
const sel = (ids: string[], anchor: string | null = null, mode = false) => ({
  ids: new Set(ids),
  anchor,
  mode,
});

describe('board selection', () => {
  it('orders the selected cards as the board reads, columns first', () => {
    expect(selectionOrder(p, new Set([e.id, b.id, d.id]))).toEqual([b.id, d.id, e.id]);
    expect(selectionOrder(p, new Set())).toEqual([]);
  });

  it('keeps the same selection while the board draws every card in it', () => {
    const s = sel([a.id, d.id], a.id);
    expect(selectionShown(p, s)).toBe(s);
    expect(selectionShown(p, NO_SELECTION)).toBe(NO_SELECTION);
  });

  it('ends select mode when nothing is left selected', () => {
    expect(selectionShown(p, sel([], null, true))).toBe(NO_SELECTION);
  });

  it('lets go of a card the board no longer draws, and of an anchor gone with it', () => {
    const gone = projectBoard(setup, new Map([a, d].map((i) => [i.id, i])));
    expect(selectionShown(gone, sel([a.id, b.id], b.id, true))).toEqual(sel([a.id], null, true));
    expect(selectionShown(gone, sel([a.id, b.id], a.id))).toEqual(sel([a.id], a.id));
    expect(selectionShown(gone, sel([b.id, c.id]))).toBe(NO_SELECTION);
  });

  it('toggles a card in and out, the last one picked the next range start', () => {
    const one = toggleCard(NO_SELECTION, a.id);
    expect(one).toEqual(sel([a.id], a.id));
    expect(toggleCard(sel([a.id, b.id], a.id, true), b.id)).toEqual(sel([a.id], b.id, true));
    expect(toggleCard(one, a.id)).toBe(NO_SELECTION);
  });

  it('ranges within one column, either way, else picks the card alone', () => {
    expect(rangeInColumn(p, a.id, c.id)).toEqual([a.id, b.id, c.id]);
    expect(rangeInColumn(p, c.id, b.id)).toEqual([b.id, c.id]);
    expect(rangeInColumn(p, a.id, d.id)).toEqual([d.id]);
    expect(rangeInColumn(p, null, b.id)).toEqual([b.id]);
    expect(rangeInColumn(p, a.id, 'missing')).toEqual(['missing']);
    expect(selectRange(p, sel([e.id], a.id), c.id)).toEqual(sel([e.id, a.id, b.id, c.id], c.id));
  });

  it('moves each card one column from its own, chained at the end of the column', () => {
    expect(groupColumnMoves(p, [a.id, b.id, d.id], 1)).toEqual([
      { id: a.id, move: { status: 'doing', before: null } },
      { id: b.id, move: { status: 'doing', after: a.id } },
      { id: d.id, move: { status: 'done', before: null } },
    ]);
    // A card at the board's edge (or not drawn) stays.
    expect(groupColumnMoves(p, [a.id, 'missing'], -1)).toEqual([]);
  });

  it('counts the selection', () => {
    expect(selectionCountLabel(1)).toBe('1 card selected');
    expect(selectionCountLabel(3)).toBe('3 cards selected');
  });
});
