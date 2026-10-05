import { describe, expect, it } from 'vitest';
import { PLAN_COLUMNS_MAX, presetSetup } from '@livediagram/items';
import {
  addColumnAfter,
  moveColumn,
  newColumnStatus,
  recolourColumn,
  removeColumn,
  renameColumn,
  setDoneColumn,
  setWipLimit,
} from './board-setup-edits';

// docs/specs/025-plan/plan-board.md "The board set-up".
const board = presetSetup('blank');
const [first, second, last] = board.columns as [
  (typeof board.columns)[number],
  (typeof board.columns)[number],
  (typeof board.columns)[number],
];

describe('board set-up edits', () => {
  it('renames, recolours and limits a column, ignoring what cannot be kept', () => {
    expect(renameColumn(board, first.id, '  Ready ').columns[0]!.name).toBe('Ready');
    expect(renameColumn(board, first.id, '   ')).toBe(board);
    expect(recolourColumn(board, first.id, '#2563eb').columns[0]!.color).toBe('#2563eb');
    expect(
      recolourColumn(recolourColumn(board, first.id, '#2563eb'), first.id, null).columns[0],
    ).not.toHaveProperty('color');
    expect(setWipLimit(board, first.id, 3).columns[0]!.wipLimit).toBe(3);
    expect(setWipLimit(board, first.id, 0).columns[0]).not.toHaveProperty('wipLimit');
    expect(setWipLimit(board, first.id, 120).columns[0]).not.toHaveProperty('wipLimit');
  });

  it('marks one done column, and clears it only from that column', () => {
    const done = setDoneColumn(board, second.id, true);
    expect(done.doneColumnId).toBe(second.id);
    expect(setDoneColumn(done, first.id, false)).toBe(done);
    expect(setDoneColumn(done, second.id, false)).not.toHaveProperty('doneColumnId');
  });

  it('moves a column, never past the ends', () => {
    expect(moveColumn(board, first.id, 1).columns.map((c) => c.id)).toEqual([
      second.id,
      first.id,
      last.id,
    ]);
    expect(moveColumn(board, first.id, -1)).toBe(board);
    expect(moveColumn(board, last.id, 1)).toBe(board);
  });

  it('adds a column after another with a unique status, until the board is full', () => {
    const added = addColumnAfter(board, first.id)!;
    expect(added.setup.columns[1]).toBe(added.column);
    expect(added.column.status).toBe('new-column');
    expect(addColumnAfter(added.setup, null)!.column.status).toBe('new-column-2');
    const full = {
      ...board,
      columns: Array.from({ length: PLAN_COLUMNS_MAX }, (_, i) => ({
        id: `c${i}`,
        status: `s${i}`,
        name: `C${i}`,
      })),
    };
    expect(addColumnAfter(full, null)).toBeNull();
    expect(newColumnStatus('!!!', [])).toBe('column');
  });

  it('removes a column but never the last, clearing done with it', () => {
    const done = setDoneColumn(board, last.id, true);
    const removed = removeColumn(done, last.id);
    expect(removed.columns).toHaveLength(2);
    expect(removed).not.toHaveProperty('doneColumnId');
    const one = { ...board, columns: [first] };
    expect(removeColumn(one, first.id)).toBe(one);
  });
});
