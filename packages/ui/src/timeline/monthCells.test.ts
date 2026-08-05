import { describe, expect, it } from 'vitest';
import {
  buildMonthCells,
  buildWeekCells,
  formatMonth,
  formatWeek,
  shiftMonth,
  shiftWeek,
  weekStartOf,
} from './monthCells';

describe('buildMonthCells', () => {
  it('pads to Monday-first and fills whole weeks', () => {
    // 1 August 2026 is a Saturday, so five pad squares lead the grid.
    const cells = buildMonthCells('2026-08');
    expect(cells.slice(0, 5).every((c) => c.key === null)).toBe(true);
    expect(cells[5]).toMatchObject({ day: 1, key: '2026-08-01' });
    expect(cells.length % 7).toBe(0);
  });

  it('pads a month that starts on a Sunday by six, not zero', () => {
    // February 2026 starts on a Sunday — the case a naive getUTCDay()
    // would pad by zero and shift the whole month a column left.
    const cells = buildMonthCells('2026-02');
    expect(cells.slice(0, 6).every((c) => c.key === null)).toBe(true);
    expect(cells[6]).toMatchObject({ day: 1 });
  });

  it('knows how long a leap February is', () => {
    expect(buildMonthCells('2028-02').filter((c) => c.key).length).toBe(29);
    expect(buildMonthCells('2026-02').filter((c) => c.key).length).toBe(28);
  });

  it('returns nothing for a malformed month key', () => {
    expect(buildMonthCells('nonsense')).toEqual([]);
  });
});

describe('shiftMonth', () => {
  it('rolls over a year boundary in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('formatMonth', () => {
  it('reads as a month and year', () => {
    expect(formatMonth('2026-08')).toBe('August 2026');
  });
});

describe('weekStartOf', () => {
  // Monday-first, matching the grid. The case a naive getDay() gets
  // wrong is Sunday: it reads as 0 and would sit at the START of its
  // week rather than the end of the previous one.
  it('finds the Monday of the containing week', () => {
    expect(weekStartOf('2026-08-05')).toBe('2026-08-03'); // Wed -> Mon
    expect(weekStartOf('2026-08-03')).toBe('2026-08-03'); // Mon -> itself
    expect(weekStartOf('2026-08-09')).toBe('2026-08-03'); // Sun -> the Mon before
  });

  it('steps back across a month boundary', () => {
    expect(weekStartOf('2026-09-01')).toBe('2026-08-31');
  });
});

describe('shiftWeek', () => {
  it('moves seven days and crosses months and years', () => {
    expect(shiftWeek('2026-08-03', 1)).toBe('2026-08-10');
    expect(shiftWeek('2026-08-31', 1)).toBe('2026-09-07');
    expect(shiftWeek('2026-01-04', -1)).toBe('2025-12-28');
  });
});

describe('buildWeekCells', () => {
  it('is seven consecutive days from the Monday', () => {
    const cells = buildWeekCells('2026-08-03');
    expect(cells).toHaveLength(7);
    expect(cells[0]!.key).toBe('2026-08-03');
    expect(cells[6]!.key).toBe('2026-08-09');
    // Unlike a month grid, every cell is a real day — no padding.
    expect(cells.every((c) => c.key !== null)).toBe(true);
  });

  it('runs across a month boundary without a gap', () => {
    const cells = buildWeekCells('2026-08-31');
    expect(cells.map((c) => c.key)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });
});

describe('formatWeek', () => {
  it('reads as a range', () => {
    expect(formatWeek('2026-08-03')).toBe('3 Aug – 9 Aug');
  });
});
