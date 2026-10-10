import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { applySheetWrite, type SheetWrite } from './store';
import { regionAround, sheetChartTable, CHART_SERIES_MAX } from './chart-data';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };

function setup(cells: Record<string, string>) {
  const b = book(cells, { rows: 10, cols: 26 });
  const link = (r1: number, c1: number, r2: number, c2: number) => {
    const { rows, cols } = b.sheets[0]!.layout;
    return {
      sheetId: b.sheets[0]!.id,
      range: { r1: rows[r1]!, c1: cols[c1]!, r2: rows[r2]!, c2: cols[c2]! },
    };
  };
  const apply = (w: SheetWrite) => {
    const r = applySheetWrite(b.sheets[0]!, w, ctx);
    b.sheets[0] = r.sheet;
    b.wb.updateSheet(r.sheet, w.kind === 'cells' ? r.touched : undefined);
  };
  return { b, link, apply };
}

describe('a chart from a range', () => {
  it('reads a header row, a label column and one series per other column', () => {
    const { b, link } = setup({
      A1: 'Month',
      B1: 'Sales',
      C1: 'Costs',
      A2: 'Jan',
      B2: '10',
      C2: '4',
      A3: 'Feb',
      B3: '=B2*2',
      C3: 'n/a',
    });
    expect(sheetChartTable(b.wb, link(0, 0, 2, 2), 'en-GB')).toEqual({
      categories: ['Jan', 'Feb'],
      series: [
        { name: 'Sales', values: [10, 20] },
        { name: 'Costs', values: [4, 0] },
      ],
    });
  });

  it('numbers the categories and names series by column without labels or a header', () => {
    const { b, link } = setup({ B1: '1', C1: '2', B2: '3', C2: '4' });
    expect(sheetChartTable(b.wb, link(0, 1, 1, 2), 'en-GB')).toEqual({
      categories: ['1', '2'],
      series: [
        { name: 'Column B', values: [1, 3] },
        { name: 'Column C', values: [2, 4] },
      ],
    });
  });

  // sheet.md "Charts": several ranges picked together read only their columns.
  it('reads only the columns a link names', () => {
    const { b, link } = setup({
      A1: 'Item',
      B1: 'Category',
      C1: 'Amount',
      A2: 'Rent',
      B2: 'Home',
      C2: '1200',
      A3: 'Food',
      B3: 'Home',
      C3: '320',
    });
    const { cols } = b.sheets[0]!.layout;
    expect(
      sheetChartTable(b.wb, { ...link(0, 0, 2, 2), cols: [cols[0]!, cols[2]!] }, 'en-GB'),
    ).toEqual({
      categories: ['Rent', 'Food'],
      series: [{ name: 'Amount', values: [1200, 320] }],
    });
  });

  it('leaves out hidden rows', () => {
    const { b, link, apply } = setup({ A1: 'a', B1: '1', A2: 'b', B2: '2' });
    const l = link(0, 0, 1, 1);
    const rows = b.sheets[0]!.layout.rows;
    apply({ kind: 'layout', changes: [{ k: 'hide', axis: 'r', ids: [rows[0]!], hidden: true }] });
    expect(sheetChartTable(b.wb, l, 'en-GB')!.categories).toEqual(['b']);
  });

  it('is null when the sheet or a corner is gone, and empty when every row is hidden', () => {
    const { b, link, apply } = setup({ A1: '1' });
    const l = link(0, 0, 0, 0);
    expect(sheetChartTable(b.wb, { ...l, sheetId: 'nope' }, 'en-GB')).toBeNull();
    expect(sheetChartTable(b.wb, { ...l, range: { ...l.range, r1: 'gone' } }, 'en-GB')).toBeNull();
    apply({ kind: 'layout', changes: [{ k: 'hide', axis: 'r', ids: [l.range.r1], hidden: true }] });
    expect(sheetChartTable(b.wb, l, 'en-GB')).toEqual({ categories: [], series: [] });
  });

  it('keeps at most the series limit', () => {
    const cells: Record<string, string> = {};
    for (let c = 0; c < 20; c++) cells[`${String.fromCharCode(65 + c)}1`] = String(c);
    const { b, link } = setup(cells);
    expect(sheetChartTable(b.wb, link(0, 0, 0, 19), 'en-GB')!.series).toHaveLength(
      CHART_SERIES_MAX,
    );
  });

  it('finds the block of data around a cell, stopping at an empty row or column', () => {
    const { b } = setup({
      B2: 'Month',
      C2: 'Sales',
      B3: 'Jan',
      C3: '1',
      B4: 'Feb',
      C4: '2',
      E2: 'apart',
      B6: 'below',
    });
    const id = b.sheets[0]!.id;
    expect(regionAround(b.wb, id, { r: 2, c: 2 })).toEqual({ r1: 1, c1: 1, r2: 3, c2: 2 });
    // An empty cell beside nothing stays itself.
    expect(regionAround(b.wb, id, { r: 8, c: 8 })).toEqual({ r1: 8, c1: 8, r2: 8, c2: 8 });
  });
});
