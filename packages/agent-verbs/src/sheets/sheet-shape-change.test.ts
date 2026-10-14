// An agent's changes to a sheet's shape (docs/specs/029-sheets/sheet-store.md "Shaping a sheet"): sizes, fitting,
// merges, borders, the filter, and rows inserted in their neighbours' formats.
import { describe, expect, it } from 'vitest';
import {
  NOBODY,
  Workbook,
  applySheetWrite,
  cellKey,
  emptyLayout,
  posRangeOf,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import { buildSheetChange, type SheetChange } from './sheet-change-build';

let n = 1;
const rand = () => ((n = (n * 16807) % 2147483647), n / 2147483647);

function book() {
  n = 11;
  const sheet: Sheet = {
    id: 'sheet_shape1',
    tabId: 'tab',
    title: 'Shape',
    layout: emptyLayout(rand, 20, 6),
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: NOBODY,
  };
  const wb = new Workbook({ sheets: [sheet], locale: 'en-GB' });
  const run = (change: SheetChange) => {
    const built = buildSheetChange(wb, sheet.id, change, [], rand);
    if (!built.ok) return built;
    for (const w of built.writes) {
      const next = applySheetWrite(wb.sheet(sheet.id)!, w as SheetWrite, {
        now: 1,
        by: NOBODY,
      }).sheet;
      wb.updateSheet(next);
    }
    return built;
  };
  const at = () => wb.sheet(sheet.id)!;
  return { wb, at, run };
}

const code = (b: ReturnType<typeof book>, change: SheetChange) => {
  const r = b.run(change);
  return r.ok ? null : r.code;
};

describe('sizes', () => {
  it('sizes columns and rows in px, and fits columns to what they show', () => {
    const b = book();
    expect(b.run({ op: 'resize', cols: 'B:C', px: 180 })).toMatchObject({
      line: 'sized columns B:C to 180 px',
    });
    expect(b.run({ op: 'resize', rows: '1', px: 40.4 })).toMatchObject({
      line: 'sized row 1 to 40 px',
    });
    const { layout } = b.at();
    expect(layout.colSize).toEqual({ [layout.cols[1]!]: 180, [layout.cols[2]!]: 180 });
    expect(layout.rowSize).toEqual({ [layout.rows[0]!]: 40 });
    b.run({ op: 'set', at: 'A1', rows: [['A rather long deal name'], ['x']] });
    expect(b.run({ op: 'resize', cols: 'A:B', fit: true })).toMatchObject({
      line: 'fitted columns A:B to their cells',
    });
    expect(b.at().layout.colSize![layout.cols[0]!]).toBeGreaterThan(160);
    // B holds nothing, so it keeps its width.
    expect(b.at().layout.colSize![layout.cols[1]!]).toBe(180);
    expect(b.run({ op: 'resize', cols: 'E', fit: true })).toMatchObject({
      writes: [],
      line: 'nothing to fit in column E',
    });
  });

  it('refuses a size it cannot set', () => {
    const b = book();
    expect(code(b, { op: 'resize', px: 100 })).toBe('write_invalid');
    expect(code(b, { op: 'resize', cols: 'A', rows: '1', px: 100 })).toBe('write_invalid');
    expect(code(b, { op: 'resize', cols: 'A', px: 4 })).toBe('write_invalid');
    expect(code(b, { op: 'resize', cols: 'A' })).toBe('write_invalid');
    expect(code(b, { op: 'resize', rows: '2', fit: true })).toBe('write_invalid');
    expect(code(b, { op: 'resize', cols: '9', px: 100 })).toBe('range_invalid');
    expect(code(b, { op: 'resize', rows: 'x', px: 100 })).toBe('range_invalid');
    expect(code(b, { op: 'resize', rows: '1:2:3', px: 100 })).toBe('range_invalid');
    expect(code(b, { op: 'resize', rows: '900', px: 100 })).toBe('range_invalid');
  });
});

describe('merges', () => {
  it('merges a range, saying what it cleared, merges across, and unmerges', () => {
    const b = book();
    b.run({ op: 'set', at: 'A1', rows: [['Title', 'stray']] });
    expect(b.run({ op: 'merge', range: 'A1:F1' })).toMatchObject({
      line: 'merged A1:F1, clearing 1 cell under the merge',
    });
    const { layout } = b.at();
    expect(posRangeOf(layout, layout.merges![0]!)).toEqual({ r1: 0, c1: 0, r2: 0, c2: 5 });
    expect(b.run({ op: 'merge', range: 'A3:B4', across: true })).toMatchObject({
      line: 'merged A3:B4 across',
    });
    expect(b.at().layout.merges).toHaveLength(3);
    expect(b.run({ op: 'unmerge', range: 'A1:A4' })).toMatchObject({ line: 'unmerged A1:A4' });
    expect(b.at().layout.merges ?? []).toHaveLength(0);
    expect(b.run({ op: 'unmerge', range: 'A1' })).toMatchObject({
      writes: [],
      line: 'nothing is merged in A1',
    });
    expect(code(b, { op: 'merge', range: 'B2' })).toBe('range_invalid');
    expect(code(b, { op: 'merge', range: 'nope' })).toBe('range_invalid');
    expect(code(b, { op: 'unmerge', range: 'nope' })).toBe('range_invalid');
  });
});

describe('borders', () => {
  it('draws borders by sides, in the default rule or a given one, and takes them off', () => {
    const b = book();
    expect(b.run({ op: 'border', range: 'A1:B2' })).toMatchObject({
      line: 'drew all borders on A1:B2',
    });
    const { rows, cols } = b.at().layout;
    expect(b.at().cells.get(cellKey(rows[0]!, cols[0]!))?.format?.bt).toEqual({
      w: 1,
      s: 'solid',
      c: '#cbd5e1',
    });
    b.run({
      op: 'border',
      range: 'C3:D4',
      sides: 'outer',
      color: '#0F172A',
      width: 2,
      style: 'dashed',
    });
    expect(b.at().cells.get(cellKey(rows[2]!, cols[2]!))?.format).toMatchObject({
      bt: { w: 2, s: 'dashed', c: '#0f172a' },
      bl: { w: 2, s: 'dashed', c: '#0f172a' },
    });
    expect(b.run({ op: 'border', range: 'A1:B2', sides: 'none' })).toMatchObject({
      line: 'took the borders off A1:B2',
    });
    expect(b.at().cells.get(cellKey(rows[0]!, cols[0]!))?.format?.bt).toBeUndefined();
    expect(code(b, { op: 'border', range: 'A1', color: 'red' })).toBe('format_invalid');
    expect(code(b, { op: 'border', range: '??' })).toBe('range_invalid');
  });
});

describe('the filter', () => {
  it('turns on over a range and off again', () => {
    const b = book();
    expect(b.run({ op: 'filter', range: 'A1:C10' })).toMatchObject({
      line: 'turned the filter on over A1:C10',
    });
    const { layout } = b.at();
    expect(posRangeOf(layout, layout.filter!)).toEqual({ r1: 0, c1: 0, r2: 9, c2: 2 });
    expect(b.run({ op: 'filter', range: null })).toMatchObject({ line: 'turned the filter off' });
    expect(b.at().layout.filter).toBeUndefined();
    expect(b.run({ op: 'filter' })).toMatchObject({ writes: [] });
    expect(code(b, { op: 'filter', range: 'Z' })).toBe('range_invalid');
  });
});

describe('inserted rows and columns', () => {
  it('take the formats of the row above them, or below at the top, and of the column left of them', () => {
    const b = book();
    b.run({
      op: 'set',
      at: 'A1',
      rows: [
        ['Head', 'H2'],
        ['body', '1'],
        ['Total', '1'],
      ],
    });
    b.run({ op: 'format', range: 'A1:B1', format: { bold: true, background: '#e0f2fe' } });
    b.run({ op: 'format', range: 'B2', format: { numberFormat: 'currency', decimals: 2 } });
    b.run({ op: 'format', range: 'A3:B3', format: { bold: true } });
    // Two rows above the total: they look like the body row over them.
    b.run({ op: 'insert_rows', at: 3, count: 2 });
    const s = b.at();
    const fmt = (r: number, c: number) =>
      s.cells.get(cellKey(s.layout.rows[r]!, s.layout.cols[c]!))?.format;
    expect(fmt(2, 1)).toMatchObject({ nf: 'currency', dp: 2 });
    expect(fmt(3, 1)).toMatchObject({ nf: 'currency', dp: 2 });
    expect(fmt(2, 0)?.b).toBeUndefined();
    // A row at the very top takes the header's look below it.
    b.run({ op: 'insert_rows', at: 1, side: 'before' });
    const t = b.at();
    expect(t.cells.get(cellKey(t.layout.rows[0]!, t.layout.cols[0]!))?.format).toMatchObject({
      b: true,
      bg: '#e0f2fe',
    });
    b.run({ op: 'insert_cols', at: 'B', side: 'after' });
    const u = b.at();
    expect(u.cells.get(cellKey(u.layout.rows[3]!, u.layout.cols[2]!))?.format).toMatchObject({
      nf: 'currency',
    });
  });
});
