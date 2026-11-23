// What a live read gives an element (liveworkspace/docs/specs/004-index/live-data.md "The element"): picked series, a
// table's cells, bounded, and the patch that keeps a table's sizes only while its grid keeps its shape.
import { describe, expect, it } from 'vitest';
import {
  LIVE_TABLE_COLS_MAX,
  LIVE_TABLE_ROWS_MAX,
  liveCellText,
  liveTablePatch,
  pickSeries,
  tableCellsFromRead,
} from './live-data-table';

const TABLE = {
  categories: ['Q1', 'Q2'],
  series: [
    { name: 'Plan', values: [10, 20] },
    { name: 'Actual', values: [9.256, 21] },
  ],
};

describe('pickSeries', () => {
  it('orders the series the link names, skipping one past the read', () => {
    expect(pickSeries(TABLE, [1, 0, 5]).series.map((s) => s.name)).toEqual(['Actual', 'Plan']);
    expect(pickSeries(TABLE, [1]).series.map((s) => s.name)).toEqual(['Actual']);
  });

  it('keeps every series when it names none, or none that is there', () => {
    expect(pickSeries(TABLE, undefined)).toBe(TABLE);
    expect(pickSeries(TABLE, [])).toBe(TABLE);
    expect(pickSeries(TABLE, [7])).toBe(TABLE);
  });
});

describe('tableCellsFromRead', () => {
  it('writes a header row, then a row per category', () => {
    expect(tableCellsFromRead(TABLE, 'Quarter')).toEqual([
      ['Quarter', 'Plan', 'Actual'],
      ['Q1', '10', '9.26'],
      ['Q2', '20', '21'],
    ]);
    expect(
      tableCellsFromRead({ categories: ['A', 'B'], series: [{ name: 'S', values: [1] }] }, ''),
    ).toEqual([
      ['', 'S'],
      ['A', '1'],
      ['B', ''],
    ]);
  });

  it('never grows past the caps', () => {
    const big = {
      categories: Array.from({ length: 900 }, (_, i) => `c${i}`),
      series: Array.from({ length: 20 }, (_, i) => ({ name: `s${i}`, values: [i] })),
    };
    const cells = tableCellsFromRead(big, 'x');
    expect(cells).toHaveLength(LIVE_TABLE_ROWS_MAX);
    expect(cells[0]).toHaveLength(LIVE_TABLE_COLS_MAX);
  });

  it('prints numbers plainly', () => {
    expect(liveCellText(1e21)).toBe('1e+21');
    expect(liveCellText(0.1 + 0.2)).toBe('0.3');
    expect(liveCellText(-3)).toBe('-3');
  });
});

describe('liveTablePatch', () => {
  const cells = [
    ['Quarter', 'Plan'],
    ['Q1', '10'],
  ];

  it('writes nothing when the table already holds the read', () => {
    expect(liveTablePatch({ cells, headerRow: true }, cells)).toBeNull();
  });

  it('keeps sizes and styles while the grid keeps its shape', () => {
    const el = {
      cells: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      colWidths: [40, null],
      rowHeights: [20, 20],
    };
    expect(liveTablePatch(el, cells)).toEqual({ cells, headerRow: true });
  });

  it('takes an empty grid either way', () => {
    expect(liveTablePatch({ cells: [] }, [])).toEqual({ cells: [], headerRow: true });
  });

  it('drops what a reshaped grid would misalign', () => {
    const el = { cells: [['a']], colWidths: [40], rowHeights: [20], cellStyles: [[null]] };
    expect(liveTablePatch(el, cells)).toEqual({
      cells,
      headerRow: true,
      colWidths: undefined,
      rowHeights: undefined,
      cellStyles: undefined,
    });
    expect(liveTablePatch({ cells: [['a', 'b']] }, cells)).toEqual({
      cells,
      headerRow: true,
      rowHeights: undefined,
      cellStyles: undefined,
    });
  });
});
