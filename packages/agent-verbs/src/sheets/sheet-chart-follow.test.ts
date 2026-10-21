// A sheet's charts kept with their cells, and the charts clear_charts takes (docs/specs/029-sheets/sheet-store.md
// "Shaping a sheet").
import { describe, expect, it } from 'vitest';
import { emptyLayout, type SheetLayout } from '@liveplanner/sheets';
import { seeded } from '../testing/sheets';
import {
  anchorCell,
  anchorOnCell,
  chartsCleared,
  chartsFollowing,
  type SheetChartEl,
} from './sheet-chart-follow';

const layout: SheetLayout = emptyLayout(seeded(3), 20, 10);
const { rows, cols } = layout;
const chart = (
  id: string,
  x: number,
  y: number,
  range?: [number, number, number, number],
): SheetChartEl => ({
  id,
  chartSource: {
    sheetId: 'sh',
    ...(range
      ? {
          range: {
            r1: rows[range[0]]!,
            c1: cols[range[1]]!,
            r2: rows[range[2]]!,
            c2: cols[range[3]]!,
          },
        }
      : {}),
  },
  sheetAnchor: { x, y },
});

describe('a chart kept with its cell', () => {
  it('reads the cell under its anchor and its offset in it, past hidden lines, the last line past the end', () => {
    expect(anchorCell(layout, { x: 250, y: 30 })).toEqual({
      row: rows[1],
      col: cols[2],
      dx: 10,
      dy: 2,
    });
    const hidden = { ...layout, hiddenCols: [cols[0]!] };
    expect(anchorCell(hidden, { x: 10, y: 0 })).toMatchObject({ col: cols[1], dx: 10 });
    expect(anchorCell(layout, { x: 99999, y: 0 })).toMatchObject({
      col: cols[9],
      dx: 99999 - 9 * 120,
    });
    expect(anchorCell({ ...layout, cols: [] }, { x: 0, y: 0 })).toBeNull();
  });

  it('puts it back on its cell after columns are inserted or widened before it, and leaves one whose cell went', () => {
    const before = layout;
    const after: SheetLayout = { ...layout, cols: ['new', ...cols], colSize: { [cols[0]!]: 200 } };
    const charts = [chart('a', 250, 30), chart('b', 0, 0), chart('gone', 1100, 0), { id: 'free' }];
    const moved = chartsFollowing(charts, 'sh', before, after);
    expect(moved).toEqual([
      { id: 'a', sheetAnchor: { x: 120 + 200 + 120 + 10, y: 30 } },
      { id: 'b', sheetAnchor: { x: 120, y: 0 } },
      { id: 'gone', sheetAnchor: { x: 120 + 200 + 8 * 120 + 20, y: 0 } },
    ]);
    expect(chartsFollowing(charts, 'sh', before, before)).toEqual([]);
    expect(chartsFollowing(charts, 'other', before, after)).toEqual([]);
    expect(
      anchorOnCell(
        { ...layout, cols: cols.slice(1) },
        { row: rows[0]!, col: cols[0]!, dx: 0, dy: 0 },
      ),
    ).toBeNull();
    // Unmoved cells keep a chart where it is.
    expect(
      chartsFollowing([chart('c', 10, 10)], 'sh', before, {
        ...layout,
        colSize: { [cols[5]!]: 300 },
      }),
    ).toEqual([]);
  });
});

describe('charts cleared', () => {
  it('are every chart of the sheet, or those reading a cell of a range', () => {
    const charts = [
      chart('a', 0, 0, [3, 0, 8, 2]),
      chart('b', 0, 0, [12, 4, 15, 5]),
      chart('c', 0, 0),
    ];
    expect(chartsCleared(charts, 'sh', layout, null)).toEqual(['a', 'b', 'c']);
    expect(chartsCleared(charts, 'sh', layout, { r1: 0, c1: 0, r2: 4, c2: 0 })).toEqual(['a']);
    expect(chartsCleared(charts, 'sh', layout, { r1: 16, c1: 0, r2: 19, c2: 9 })).toEqual([]);
    expect(chartsCleared(charts, 'other', layout, null)).toEqual([]);
  });
});
