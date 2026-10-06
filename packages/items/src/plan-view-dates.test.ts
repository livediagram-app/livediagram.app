import { describe, expect, it } from 'vitest';
import {
  WEEKDAY_SHORT,
  dayKey,
  dayNumber,
  dayParts,
  daysInMonth,
  monthStart,
  shiftMonth,
} from './plan-view-dates';

describe('shiftMonth', () => {
  it('steps across a year in either direction', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 5, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe('daysInMonth', () => {
  it('counts the days of a month, leap Februaries included', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
    expect(daysInMonth(2026, 11)).toBe(31);
  });
});

describe('dayKey', () => {
  it('is the inverse of dayNumber', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2028-02-29', '1999-12-31']) {
      expect(dayKey(dayNumber(key)!)).toBe(key);
    }
  });

  it('pads the month and day', () => {
    expect(dayKey(monthStart(2026, 2))).toBe('2026-03-01');
  });
});

describe('WEEKDAY_SHORT', () => {
  it('starts on Monday, matching dayParts', () => {
    // 2026-10-05 is a Monday.
    expect(WEEKDAY_SHORT[dayParts(dayNumber('2026-10-05')!).weekday]).toBe('Mon');
    expect(WEEKDAY_SHORT[dayParts(dayNumber('2026-10-11')!).weekday]).toBe('Sun');
  });
});
