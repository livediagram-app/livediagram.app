import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  CALENDAR_WEEKS,
  calendarMonth,
  cursorOf,
  longDay,
  monthTitle,
  shortDay,
  stepMonth,
} from './calendar-month';

// docs/specs/009-elements/team-pieces.md "Calendar Wall": six weeks of days, Monday first, each named as a note's day.

describe('calendarMonth', () => {
  it('lays November 2026 from Monday 26 October, today marked', () => {
    const cells = calendarMonth({ year: 2026, month: 10 }, '2026-11-07');
    expect(cells).toHaveLength(CALENDAR_WEEKS * 7);
    expect(cells[0]).toEqual({ day: '2026-10-26', date: 26, inMonth: false, isToday: false });
    expect(cells[6]!.day).toBe('2026-11-01');
    expect(cells[6]!.inMonth).toBe(true);
    expect(cells.filter((c) => c.isToday).map((c) => c.day)).toEqual(['2026-11-07']);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
    expect(cells.at(-1)!.day).toBe('2026-12-06');
  });

  it('starts a month that begins on a Monday in the first cell, and fits a 31-day month from a Sunday', () => {
    // June 2026 begins on a Monday.
    expect(calendarMonth({ year: 2026, month: 5 }, '')[0]!.day).toBe('2026-06-01');
    // March 2026 begins on a Sunday: 31 days need the sixth week.
    const march = calendarMonth({ year: 2026, month: 2 }, '');
    expect(march[6]!.day).toBe('2026-03-01');
    expect(march.filter((c) => c.inMonth).at(-1)!.day).toBe('2026-03-31');
  });

  it('counts a leap February', () => {
    expect(calendarMonth({ year: 2028, month: 1 }, '').filter((c) => c.inMonth)).toHaveLength(29);
  });

  it('costs next to nothing to lay out, a year of months at a time', () => {
    // A month is 42 cells; a re-render lays one. ~0.4ms measured for 1200; best of three, on CPU time.
    const best = Math.min(
      ...[0, 1, 2].map(() =>
        cpuMsOf(() => {
          for (let i = 0; i < 1200; i += 1)
            calendarMonth({ year: 2026, month: i % 12 }, '2026-11-07');
        }),
      ),
    );
    expect(best).toBeLessThan(cpuBudgetMs(40));
  });
});

describe('stepping and naming months', () => {
  it('steps across a year either way', () => {
    expect(stepMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(stepMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(stepMonth({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });

  it('reads the month of a day', () => {
    expect(cursorOf('2026-11-07')).toEqual({ year: 2026, month: 10 });
  });

  it('names months and days in words, whatever the clock’s zone', () => {
    expect(monthTitle({ year: 2026, month: 10 })).toBe('November 2026');
    expect(shortDay('2026-11-05')).toBe('5 Nov');
    expect(longDay('2026-11-05')).toBe('5 November');
  });
});
