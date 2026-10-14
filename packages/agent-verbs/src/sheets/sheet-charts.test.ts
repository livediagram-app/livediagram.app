// change_sheet's chart (docs/specs/029-sheets/sheet-store.md "Shaping a sheet"): a range in A1, some of its columns by
// letter, at a cell; refused in words.
import { describe, expect, it } from 'vitest';
import { NOBODY, Workbook, emptyLayout, posRangeOf, type Sheet } from '@livediagram/sheets';
import { anchorAt, buildChartChange, type SheetChartChange } from './sheet-charts';
import { seeded } from '../testing/sheets';

function book() {
  const rand = seeded(9);
  const layout = emptyLayout(rand, 20, 8);
  const sheet: Sheet = {
    id: 'sheet_chart1',
    tabId: 'tab',
    title: 'C',
    layout: {
      ...layout,
      colSize: { [layout.cols[0]!]: 200 },
      hiddenRows: [layout.rows[1]!],
      hiddenCols: [layout.cols[6]!],
    },
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: NOBODY,
  };
  return { sheet, wb: new Workbook({ sheets: [sheet], locale: 'en-GB' }) };
}

const run = (change: Omit<SheetChartChange, 'op'>) => {
  const { wb, sheet } = book();
  return { built: buildChartChange(wb, sheet.id, { op: 'chart', ...change }), sheet };
};

describe('a chart over cells', () => {
  it('reads its range and columns, at the cell right of it by default, sized within bounds', () => {
    const { built, sheet } = run({
      type: 'pie',
      range: 'A4:C9',
      columns: ['a', 'C'],
      width: 50,
      height: 300.4,
    });
    if (!built.ok) throw new Error(built.message);
    expect(built.line).toBe('charted A4:C9 as a pie chart at the cell right of it');
    const [chart] = built.charts;
    expect(posRangeOf(sheet.layout, chart!.range)).toEqual({ r1: 3, c1: 0, r2: 8, c2: 2 });
    expect(chart!.cols).toEqual([sheet.layout.cols[0], sheet.layout.cols[2]]);
    // E4: past A (200 px) and B to D (120 each); rows 1 and 3 above it (row 2 hidden).
    expect(chart!.anchor).toEqual({ x: 200 + 3 * 120, y: 2 * 28 });
    expect(chart).toMatchObject({ width: 160, height: 300 });
  });

  it('is refused for a range it cannot chart, a column outside it, or a cell it cannot read', () => {
    const code = (change: Omit<SheetChartChange, 'op'>) => {
      const { built } = run(change);
      return built.ok ? null : built.message;
    };
    expect(code({ type: 'bar', range: 'nope' })).toMatch(/is not a range of the sheet/);
    expect(code({ type: 'bar', range: 'A1:Z5' })).toMatch(/is not a range of the sheet/);
    expect(code({ type: 'bar', range: 'A4:C4' })).toBe(
      'A chart reads a header row and at least one row of data.',
    );
    expect(code({ type: 'bar', range: 'A4:C9', columns: ['F'] })).toBe(
      'Column "F" is not a column of A4:C9.',
    );
    expect(code({ type: 'bar', range: 'A4:C9', at: '?' })).toBe(
      '"?" is not a cell in A1 form ("H4").',
    );
  });

  it('anchors at A1 with nothing before it, and passes hidden columns by', () => {
    expect(anchorAt(book().sheet.layout, [0, 0])).toEqual({ x: 0, y: 0 });
    // A at 200, B to F at 120 each, G hidden.
    expect(anchorAt(book().sheet.layout, [0, 7]).x).toBe(200 + 5 * 120);
  });
});
