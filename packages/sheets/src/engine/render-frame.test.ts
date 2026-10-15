import { describe, expect, it } from 'vitest';
import { book } from '../testing/book';
import { cellKey } from '../sheet';
import { renderFrameWindow, renderWindow, sheetContentSize } from './render';

// One Sheet element's window from a workbook the caller already holds (docs/specs/026-plan/plan-tabs.md "Export"):
// the grid area inside the static render's header (62 px) and row heads (46 px).
describe('renderFrameWindow', () => {
  it('is the window of the frame’s grid area', () => {
    const b = book({ A1: 'Title', B2: '7' });
    const s = b.sheets[0]!;
    const framed = renderFrameWindow(b.wb, { sheetId: s.id, width: 46 + 300, height: 62 + 120 });
    expect(framed).toEqual(renderWindow(b.wb, s.id, { width: 300, height: 120 }, 'en-GB'));
    expect(framed!.cells.map((c) => c.text)).toEqual(['Title', '7']);
  });

  it('is undefined for a sheet the workbook does not hold', () => {
    const b = book({ A1: 'x' });
    expect(renderFrameWindow(b.wb, { sheetId: 'gone', width: 400, height: 300 })).toBeUndefined();
  });
});

// docs/specs/029-sheets/sheet.md "Exports and images": the grid a sheet's cells fill, and one more row and column.
describe('sheetContentSize', () => {
  it('reaches the last cell with an input, a fill or a merge, and one row and column more', () => {
    const b = book({ A1: 'Title', C4: '7' });
    const s = b.sheets[0]!;
    expect(sheetContentSize(s)).toEqual({ width: 4 * 120, height: 5 * 28 });
    const { rows, cols } = s.layout;
    s.cells.set(cellKey(rows[9]!, cols[0]!), { format: { bg: '#ff0000' } });
    s.cells.set(cellKey(rows[1]!, cols[1]!), { format: { b: true } });
    const merged = {
      ...s,
      layout: {
        ...s.layout,
        colSize: { [cols[0]!]: 200 },
        hiddenRows: [rows[2]!],
        merges: [{ r1: rows[0]!, c1: cols[0]!, r2: rows[0]!, c2: cols[5]! }],
      },
    };
    expect(sheetContentSize(merged)).toEqual({ width: 200 + 6 * 120, height: 10 * 28 });
  });

  it('is null for a sheet with nothing in it, a lone bold cell included', () => {
    const b = book({});
    const s = b.sheets[0]!;
    s.cells.set(cellKey(s.layout.rows[0]!, s.layout.cols[0]!), { format: { b: true } });
    expect(sheetContentSize(s)).toBeNull();
  });
});
