import { describe, expect, it } from 'vitest';
import {
  addTableColumn,
  addTableRow,
  canAddTableColumn,
  canAddTableRow,
  clearCellStyle,
  moveTableColumn,
  moveTableRow,
  normalizeTable,
  pasteIntoTable,
  removeTableColumn,
  removeTableRow,
  setCellStyle,
  setTableCell,
  TABLE_CELLS_MAX,
  TABLE_COLS_MAX,
  TABLE_ROWS_MAX,
  tableColCount,
  tableRowCount,
  type TableGrid,
} from './table';

// The table helpers (docs/specs/009-elements/table.md). Each product's own table test also reads its factory and
// validator through the binding.
type Table = TableGrid & { id: string };
const grid = (rows: string[][], over: Partial<Table> = {}): Table => ({
  id: 't',
  cells: rows,
  ...over,
});
const t2x2 = () =>
  grid([
    ['a', 'b'],
    ['c', 'd'],
  ]);

describe('reading and normalising', () => {
  it('counts rows and columns, and squares a ragged grid to at least 1x1', () => {
    expect(tableRowCount(t2x2())).toBe(2);
    expect(tableColCount(t2x2())).toBe(2);
    expect(tableColCount(grid([]))).toBe(0);
    expect(normalizeTable(grid([['a'], ['b', 'c']])).cells).toEqual([
      ['a', ''],
      ['b', 'c'],
    ]);
    expect(normalizeTable(grid([])).cells).toEqual([['']]);
  });

  it('sets one cell, and leaves the table for a cell outside it', () => {
    expect(setTableCell(t2x2(), 1, 0, 'z').cells).toEqual([
      ['a', 'b'],
      ['z', 'd'],
    ]);
    const t = t2x2();
    expect(setTableCell(t, 5, 0, 'z')).toBe(t);
    expect(setTableCell(t, 0, 9, 'z')).toBe(t);
  });
});

describe('rows and columns', () => {
  it('adds a row with its tracks, at the end or at an index', () => {
    const t = grid([['a', 'b']], { rowHeights: [40], cellStyles: [[{ bold: true }, null]] });
    const out = addTableRow(t, 0);
    expect(out.cells).toEqual([
      ['', ''],
      ['a', 'b'],
    ]);
    expect(out.rowHeights).toEqual([null, 40]);
    expect(out.cellStyles).toEqual([
      [null, null],
      [{ bold: true }, null],
    ]);
    expect(addTableRow(t2x2()).cells[2]).toEqual(['', '']);
  });

  it('removes a row, never the last', () => {
    const t = grid([['a'], ['b']], {
      rowHeights: [1, 2],
      cellStyles: [[null], [{ italic: true }]],
    });
    expect(removeTableRow(t, 0)).toMatchObject({
      cells: [['b']],
      rowHeights: [2],
      cellStyles: [[{ italic: true }]],
    });
    expect(removeTableRow(t2x2()).cells).toEqual([['a', 'b']]);
    const one = grid([['a']]);
    expect(removeTableRow(one)).toBe(one);
  });

  it('adds and removes a column with its tracks, never the last', () => {
    const t = grid([['a']], { colWidths: [80], cellStyles: [[{ bg: '#fff' }]] });
    const out = addTableColumn(t, 0);
    expect(out).toMatchObject({
      cells: [['', 'a']],
      colWidths: [null, 80],
      cellStyles: [[null, { bg: '#fff' }]],
    });
    expect(removeTableColumn(out, 0)).toMatchObject({ cells: [['a']], colWidths: [80] });
    expect(removeTableColumn(t)).toBe(t);
    expect(addTableColumn(t2x2()).cells[0]).toEqual(['a', 'b', '']);
    expect(removeTableColumn(t2x2()).cells).toEqual([['a'], ['c']]);
  });

  it('stops at the size limits', () => {
    const wide = grid([Array.from({ length: TABLE_COLS_MAX }, () => '')]);
    expect(canAddTableColumn(wide)).toBe(false);
    expect(addTableColumn(wide)).toBe(wide);
    const tall = grid(Array.from({ length: TABLE_ROWS_MAX }, () => ['']));
    expect(canAddTableRow(tall)).toBe(false);
    expect(addTableRow(tall)).toBe(tall);
    const full = grid(
      Array.from({ length: TABLE_CELLS_MAX / 100 }, () => Array.from({ length: 100 }, () => '')),
    );
    expect(canAddTableRow(full)).toBe(false);
    expect(canAddTableColumn(full)).toBe(false);
  });

  it('moves a column and a row with their tracks, and ignores a move nowhere', () => {
    const t = grid([['a', 'b', 'c']], {
      colWidths: [1, null, 3],
      cellStyles: [[{ bold: true }, null, null]],
    });
    expect(moveTableColumn(t, 0, 2)).toMatchObject({
      cells: [['b', 'c', 'a']],
      colWidths: [null, 3, 1],
      cellStyles: [[null, null, { bold: true }]],
    });
    expect(moveTableColumn(t, 1, 1)).toBe(t);
    expect(moveTableColumn(t, 0, 7)).toBe(t);
    const rows = grid([['a'], ['b']], { rowHeights: [10], cellStyles: [[{ bold: true }]] });
    expect(moveTableRow(rows, 0, 1)).toMatchObject({
      cells: [['b'], ['a']],
      rowHeights: [null, 10],
      cellStyles: [[], [{ bold: true }]],
    });
    expect(moveTableRow(rows, 0, 0)).toBe(rows);
    expect(moveTableRow(t2x2(), 0, 1).rowHeights).toBeUndefined();
  });
});

describe('pasteIntoTable', () => {
  it('writes a grid in at a cell, growing the table to hold it', () => {
    expect(pasteIntoTable(t2x2(), 1, 1, [['x', 'y'], ['z']]).cells).toEqual([
      ['a', 'b', ''],
      ['c', 'x', 'y'],
      ['', 'z', ''],
    ]);
    const t = t2x2();
    expect(pasteIntoTable(t, 0, 0, [])).toBe(t);
  });
});

describe('cell styles', () => {
  it('merges a style into one cell, keeping only the keys it knows', () => {
    const out = setCellStyle(t2x2(), 0, 1, {
      bg: '#eee',
      textColor: '#111',
      bold: true,
      italic: false,
      underline: true,
      textSize: 'lg',
      alignX: 'center',
      link: { kind: 'url', url: 'https://example.com' },
    });
    expect(out.cellStyles![0]![1]).toMatchObject({ bg: '#eee', bold: true, alignX: 'center' });
    expect(out.cellStyles![1]).toEqual([null, null]);
    const t = t2x2();
    expect(setCellStyle(t, 9, 0, { bold: true })).toBe(t);
    expect(setCellStyle(t, 0, 0, {}).cellStyles![0]![0]).toBeNull();
  });

  it('clears a cell, and leaves a table with no styles as it was', () => {
    const styled = setCellStyle(t2x2(), 0, 0, { bold: true });
    expect(clearCellStyle(styled, 0, 0).cellStyles![0]![0]).toBeNull();
    const plain = t2x2();
    expect(clearCellStyle(plain, 0, 0)).toBe(plain);
  });
});
