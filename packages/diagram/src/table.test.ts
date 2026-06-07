import { describe, expect, it } from 'vitest';
import { createTable } from './factories';
import {
  addTableColumn,
  addTableRow,
  normalizeTable,
  removeTableColumn,
  removeTableRow,
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
