// A card table's Controls column (docs/specs/029-sheets/sheet.md "Card tables"): a table made before it had one gets
// the column just past it when the table's rows are empty there, else a new column inserted.
import { describe, expect, it } from 'vitest';
import {
  applySheetWrite,
  cellKey,
  emptyLayout,
  type CardTable,
  type Sheet,
} from '@livediagram/sheets';
import { controlsColumnWrite } from './useCardTableSync';

let seq = 9;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const by = { id: 'p', name: 'P', color: '#000000' };
const layout = emptyLayout(rand, 4, 4);
const table: CardTable = {
  id: 'tbl1',
  head: layout.rows[0]!,
  cols: [{ c: layout.cols[0]!, field: 'Title' }],
  rows: { [layout.rows[1]!]: 'i1' },
  type: 'task',
};
const sheetOf = (cells: [number, number][] = []): Sheet => ({
  id: 'sheetAAAA',
  tabId: 't1',
  title: 'S',
  layout: { ...layout, cardTables: [table] },
  cells: new Map(
    cells.map(([r, c]) => [cellKey(layout.rows[r]!, layout.cols[c]!), { input: { s: 'x' } }]),
  ),
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
});
const apply = (s: Sheet) =>
  applySheetWrite(s, controlsColumnWrite(s, table)!, { now: 1, by }).sheet;

describe('the Controls column', () => {
  it('takes the empty column past the table, sized for two buttons', () => {
    const next = apply(sheetOf());
    expect(next.layout.cardTables![0]!.controls).toBe(layout.cols[1]);
    expect(next.layout.colSize?.[layout.cols[1]!]).toBe(72);
    expect(next.layout.cols).toHaveLength(4);
  });

  it('inserts a column when the next one holds something on the table rows', () => {
    const next = apply(sheetOf([[1, 1]]));
    expect(next.layout.cols).toHaveLength(5);
    expect(next.layout.cardTables![0]!.controls).toBe(next.layout.cols[1]);
    expect(next.layout.cols[2]).toBe(layout.cols[1]);
  });

  it('is nothing for a table whose columns are gone', () => {
    expect(
      controlsColumnWrite(sheetOf(), { ...table, cols: [{ c: 'gone', field: 'Title' }] }),
    ).toBeNull();
  });
});
