import { describe, expect, it } from 'vitest';
import { createTable } from './factories';
import {
  addTableColumn,
  addTableRow,
  normalizeTable,
  clearCellStyle,
  moveTableColumn,
  moveTableRow,
  pasteIntoTable,
  removeTableColumn,
  removeTableRow,
  setCellStyle,
  setTableCell,
  tableColCount,
  tableRowCount,
} from './table';

const t = () => createTable(0, 0);

describe('table dimensions', () => {
  it('a fresh table is 3x3', () => {
    expect(tableRowCount(t())).toBe(3);
    expect(tableColCount(t())).toBe(3);
  });
});

describe('setTableCell', () => {
  it('updates one cell and leaves the rest untouched', () => {
    const next = setTableCell(t(), 1, 2, 'hi');
    expect(next.cells[1]![2]).toBe('hi');
    expect(next.cells[0]![0]).toBe('');
    expect(next).not.toBe(t()); // new object
  });

  it('ignores out-of-range coordinates', () => {
    const base = t();
    expect(setTableCell(base, 9, 0, 'x')).toBe(base);
    expect(setTableCell(base, 0, 9, 'x')).toBe(base);
    expect(setTableCell(base, -1, 0, 'x')).toBe(base);
  });
});

describe('rows', () => {
  it('addTableRow appends a blank row of the right width', () => {
    const next = addTableRow(t());
    expect(tableRowCount(next)).toBe(4);
    expect(next.cells[3]).toEqual(['', '', '']);
  });

  it('addTableRow can insert at an index', () => {
    const seeded = setTableCell(t(), 0, 0, 'top');
    const next = addTableRow(seeded, 0);
    expect(next.cells[0]).toEqual(['', '', '']);
    expect(next.cells[1]![0]).toBe('top');
  });

  it('removeTableRow drops a row but never goes below one', () => {
    let next = removeTableRow(t());
    expect(tableRowCount(next)).toBe(2);
    next = removeTableRow(next);
    next = removeTableRow(next);
    expect(tableRowCount(next)).toBe(1);
  });
});

describe('columns', () => {
  it('addTableColumn widens every row', () => {
    const next = addTableColumn(t());
    expect(tableColCount(next)).toBe(4);
    expect(next.cells.every((r) => r.length === 4)).toBe(true);
  });

  it('removeTableColumn narrows but never below one', () => {
    let next = removeTableColumn(t());
    expect(tableColCount(next)).toBe(2);
    next = removeTableColumn(next);
    next = removeTableColumn(next);
    expect(tableColCount(next)).toBe(1);
  });
});

describe('normalizeTable', () => {
  it('pads a ragged grid to a rectangle', () => {
    const ragged = { ...t(), cells: [['a'], ['b', 'c', 'd'], []] };
    const next = normalizeTable(ragged);
    expect(next.cells.every((r) => r.length === 3)).toBe(true);
    expect(next.cells[0]).toEqual(['a', '', '']);
    expect(next.cells[2]).toEqual(['', '', '']);
  });

  it('coerces an empty grid to 1x1', () => {
    const empty = { ...t(), cells: [] };
    const next = normalizeTable(empty);
    expect(tableRowCount(next)).toBe(1);
    expect(tableColCount(next)).toBe(1);
  });
});

describe('pasteIntoTable', () => {
  it('overlays a grid and grows the table to fit', () => {
    const next = pasteIntoTable(t(), 1, 1, [
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
      ['g', 'h', 'i'],
    ]);
    expect(tableRowCount(next)).toBe(4); // 1 + 3
    expect(tableColCount(next)).toBe(4); // 1 + 3
    expect(next.cells[1]![1]).toBe('a');
    expect(next.cells[3]![3]).toBe('i');
    expect(next.cells[0]![0]).toBe(''); // untouched
  });

  it('preserves cells outside the pasted block', () => {
    const seeded = setTableCell(t(), 2, 2, 'keep');
    const next = pasteIntoTable(seeded, 0, 0, [['x']]);
    expect(next.cells[0]![0]).toBe('x');
    expect(next.cells[2]![2]).toBe('keep');
  });
});

describe('cell styles', () => {
  it('sets + merges a cell style and clears it', () => {
    let next = setCellStyle(t(), 1, 1, { bg: '#ff0000' });
    expect(next.cellStyles![1]![1]).toEqual({ bg: '#ff0000' });
    next = setCellStyle(next, 1, 1, { bold: true });
    expect(next.cellStyles![1]![1]).toEqual({ bg: '#ff0000', bold: true });
    expect(next.cellStyles![0]![0]).toBeNull();
    const cleared = clearCellStyle(next, 1, 1);
    expect(cleared.cellStyles![1]![1]).toBeNull();
  });

  it('keeps cell styles aligned when a column is inserted', () => {
    const styled = setCellStyle(t(), 0, 2, { bg: '#00ff00' });
    const next = addTableColumn(styled, 0); // insert at the front
    expect(tableColCount(next)).toBe(4);
    // the styled cell shifted from col 2 to col 3
    expect(next.cellStyles![0]![3]).toEqual({ bg: '#00ff00' });
    expect(next.cellStyles![0]![0]).toBeNull();
  });
});

describe('reorder', () => {
  it('moves a column carrying its cells', () => {
    const next = moveTableColumn(setTableCell(t(), 0, 0, 'A'), 0, 2);
    expect(next.cells[0]![2]).toBe('A');
    expect(next.cells[0]![0]).toBe('');
  });

  it('moves a row carrying its cells', () => {
    const next = moveTableRow(setTableCell(t(), 0, 1, 'top'), 0, 2);
    expect(next.cells[2]![1]).toBe('top');
  });
});
