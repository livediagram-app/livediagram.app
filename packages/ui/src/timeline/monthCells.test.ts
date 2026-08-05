import { describe, expect, it } from 'vitest';
import { buildMonthCells, formatMonth, nearestPopulatedMonth, shiftMonth } from './monthCells';

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

describe('nearestPopulatedMonth', () => {
  const months = new Set(['2026-01', '2026-05', '2026-08']);

  // Stepping one empty month at a time is what makes a calendar feel
  // broken over a quiet quarter: four dead clicks to learn there was
  // nothing there.
  it('jumps over empty months rather than stepping one at a time', () => {
    expect(nearestPopulatedMonth(months, '2026-05', -1)).toBe('2026-01');
    expect(nearestPopulatedMonth(months, '2026-05', 1)).toBe('2026-08');
  });

  it('returns null at the ends so the chevron can disable', () => {
    expect(nearestPopulatedMonth(months, '2026-01', -1)).toBeNull();
    expect(nearestPopulatedMonth(months, '2026-08', 1)).toBeNull();
  });

  it('never returns the month it started from', () => {
    expect(nearestPopulatedMonth(months, '2026-08', -1)).toBe('2026-05');
  });
});
