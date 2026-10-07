import { describe, expect, it } from 'vitest';
import { PLAN_COLUMNS_MAX, presetSetup } from '@livediagram/items';
import {
  addColumnAfter,
  addFirstColumn,
  moveColumn,
  newColumnStatus,
  recolourColumn,
  removeColumn,
  renameColumn,
  setDoneColumn,
  setWipLimit,
} from './board-setup-edits';

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

// docs/specs/026-plan/plan-board.md "The board set-up".
const board = threeColumns();
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
    expect(added.column.status).toMatch(/^new-column~[a-z0-9]{4}$/);
    expect(addColumnAfter(added.setup, null)!.column.status).toMatch(/^new-column-2~[a-z0-9]{4}$/);
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

describe('setColumnWidth', () => {
  it('sets two or three slots, and stores one as absent', async () => {
    const { setColumnWidth } = await import('./board-setup-edits');
    const s = threeColumns();
    const id = s.columns[0]!.id;
    const wide = setColumnWidth(s, id, 3);
    expect(wide.columns[0]!.width).toBe(3);
    expect(setColumnWidth(wide, id, 1).columns[0]).not.toHaveProperty('width');
  });
});

describe('addFirstColumn', () => {
  it('names a board’s first column as typed, and refuses a blank name', () => {
    const empty = { ...threeColumns(), columns: [] };
    const s = addFirstColumn(empty, '  Ideas ')!;
    expect(s.columns).toHaveLength(1);
    expect(s.columns[0]!.name).toBe('Ideas');
    expect(s.columns[0]!.status).toMatch(/^ideas~[a-z0-9]{4}$/);
    expect(addFirstColumn(empty, '   ')).toBeNull();
  });
});

describe('renaming a column', () => {
  it('keeps its status, so its cards stay in it', async () => {
    const { renameColumn } = await import('./board-setup-edits');
    const s = threeColumns();
    const renamed = renameColumn(s, 'doing', 'Building');
    expect(renamed.columns[1]).toMatchObject({ name: 'Building', status: 'doing' });
  });
});

// docs/specs/026-plan/plan-board.md "Column names": a typed name is saved in Title Case.
describe('typed column names', () => {
  it('saves a rename, a new column and a first column in Title Case, keeping acronyms', () => {
    expect(renameColumn(threeColumns(), 'doing', '  ready for QA ').columns[1]!.name).toBe(
      'Ready for QA',
    );
    expect(addColumnAfter(threeColumns(), 'todo', 'in review', () => 0)?.column.name).toBe(
      'In Review',
    );
    expect(addFirstColumn(presetSetup('blank'), 'to do')?.columns[0]!.name).toBe('To Do');
    // A rename to nothing changes nothing.
    expect(renameColumn(threeColumns(), 'doing', '   ').columns[1]!.name).toBe('In progress');
  });
});
