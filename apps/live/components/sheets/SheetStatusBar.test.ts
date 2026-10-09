import { describe, expect, it } from 'vitest';
import { selectionStats, statValue } from './SheetStatusBar';

// A 4 x 2 grid of values; row 2 hidden by a filter.
const values: (number | string | null)[][] = [
  [1, 'a'],
  [2, null],
  [100, 5],
  [3, ''],
];
const controller = (ranges: { r1: number; c1: number; r2: number; c2: number }[], rows = 4) =>
  ({
    selection: { ranges, active: { r: 0, c: 0 }, anchor: { r: 0, c: 0 } },
    sheet: { id: 's' },
    workbook: {
      extent: () => ({ rows, cols: 2 }),
      value: (_s: string, r: number, c: number) => values[r % 4]![c]!,
    },
    geometry: { hiddenRow: (r: number) => r === 2 },
  }) as never;

describe('the status bar totals', () => {
  it('sums, counts and spans the numbers that show, leaving filtered rows out', () => {
    const s = selectionStats(controller([{ r1: 0, c1: 0, r2: 3, c2: 1 }]))!;
    expect(s).toEqual({ sum: 6, count: 4, numbers: 3, min: 1, max: 3 });
    expect(statValue('Average', s)).toBe(2);
    expect(statValue('Min', s)).toBe(1);
    expect(statValue('Max', s)).toBe(3);
    expect(statValue('Count', s)).toBe(4);
  });

  it('shows nothing for fewer than two numbers, or a selection too big to count', () => {
    expect(selectionStats(controller([{ r1: 0, c1: 0, r2: 0, c2: 1 }]))).toBeNull();
    // Filled past the extent counts nothing; more cells than the cap gives up rather than stall a keystroke.
    expect(selectionStats(controller([{ r1: 0, c1: 0, r2: 400_000, c2: 1 }]))).not.toBeNull();
    expect(selectionStats(controller([{ r1: 0, c1: 0, r2: 60_000, c2: 1 }], 60_001))).toBeNull();
  });
});
