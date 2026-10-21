// change_sheet's chart (docs/specs/029-sheets/sheet-store.md "Shaping a sheet"): a range in A1, some of its columns by
// letter, at a cell; refused in words.
import { describe, expect, it } from 'vitest';
import {
  NOBODY,
  Workbook,
  cellKey,
  emptyLayout,
  posRangeOf,
  templateTints,
  type Sheet,
} from '@liveplanner/sheets';
import {
  anchorAt,
  buildChartChange,
  paletteOfHeader,
  seriesNote,
  sheetChartElements,
  type SheetChartChange,
} from './sheet-charts';
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

describe('a chart’s colours and series', () => {
  it('takes the palette of its table’s header, or the one given', () => {
    const { wb, sheet } = book();
    const head = templateTints('emerald', false).head;
    const { rows, cols } = sheet.layout;
    sheet.cells.set(cellKey(rows[3]!, cols[0]!), { input: { s: 'Item' }, format: { bg: head } });
    sheet.cells.set(cellKey(rows[3]!, cols[1]!), { input: { s: 'Planned' } });
    sheet.cells.set(cellKey(rows[3]!, cols[2]!), { input: { s: 'Actual' } });
    wb.updateSheet({ ...sheet });
    const built = buildChartChange(wb, sheet.id, { op: 'chart', type: 'column', range: 'A4:C9' });
    if (!built.ok) throw new Error(built.message);
    expect(built.charts[0]!.palette).toBe('forest');
    expect(built.line).toBe(
      'charted A4:C9 as a column chart at the cell right of it (a column chart shows one series, Planned; line and area charts show all 2)',
    );
    const given = buildChartChange(wb, sheet.id, {
      op: 'chart',
      type: 'line',
      range: 'A4:C9',
      palette: 'sunset',
    });
    expect(given.ok && given.charts[0]!.palette).toBe('sunset');
    // Unnamed value columns go by their letters; a plain header takes no palette.
    const plain = buildChartChange(wb, sheet.id, { op: 'chart', type: 'pie', range: 'D4:F9' });
    expect(plain.ok && plain.charts[0]!.palette).toBeUndefined();
    expect(plain.ok && plain.line).toContain('one series, E;');
  });

  it('knows each accent’s header on either canvas, and notes only one-series types given several', () => {
    expect(paletteOfHeader(templateTints('violet', true).head)).toBe('berry');
    expect(paletteOfHeader('#123456')).toBeUndefined();
    expect(paletteOfHeader(undefined)).toBeUndefined();
    expect(seriesNote('line', ['a', 'b'])).toBe('');
    expect(seriesNote('bar', ['a'])).toBe('');
  });
});

describe('chart elements', () => {
  it('take no palette of their own when given none, drawing in the default', () => {
    const { wb, sheet } = book();
    const built = buildChartChange(wb, sheet.id, { op: 'chart', type: 'pie', range: 'A1:B3' });
    if (!built.ok) throw new Error(built.message);
    const [el] = sheetChartElements(
      wb,
      { x: 0, y: 0, width: 960, height: 560 },
      sheet.id,
      built.charts,
    );
    expect(el).toMatchObject({ shape: 'pie-chart', chartSource: { sheetId: sheet.id } });
    expect(el!.chartPalette).toBeUndefined();
  });
});
