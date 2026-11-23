import { describe, expect, it } from 'vitest';
import {
  addMonth,
  anchorDayOf,
  dayKey,
  dayStart,
  monthKey,
  monthStart,
  nextDayStart,
  nextMonthStart,
  periodKey,
} from './periods';

const at = (iso: string) => Date.parse(iso);

describe('periods', () => {
  it('key a count by its UTC day and month', () => {
    expect(dayKey(at('2026-11-20T23:59:59.999Z'))).toBe('2026-11-20');
    expect(dayKey(at('2026-11-21T00:00:00Z'))).toBe('2026-11-21');
    expect(monthKey(at('2026-11-30T23:59:59.999Z'))).toBe('2026-11');
    expect(monthKey(at('2026-12-01T00:00:00Z'))).toBe('2026-12');
  });

  it('file a daily, a monthly and a standing count under their own keys', () => {
    const now = at('2026-11-20T12:00:00Z');
    expect(periodKey('day', now)).toBe('2026-11-20');
    expect(periodKey('month', now)).toBe('2026-11');
    expect(periodKey('none', now)).toBe('all');
  });

  it('start a day and a month at midnight UTC', () => {
    const now = at('2026-11-20T12:34:56Z');
    expect(dayStart(now)).toBe(at('2026-11-20T00:00:00Z'));
    expect(nextDayStart(now)).toBe(at('2026-11-21T00:00:00Z'));
    expect(monthStart(now)).toBe(at('2026-11-01T00:00:00Z'));
    expect(nextMonthStart(now)).toBe(at('2026-12-01T00:00:00Z'));
    expect(nextMonthStart(at('2026-12-31T23:00:00Z'))).toBe(at('2027-01-01T00:00:00Z'));
  });

  it('renew on the same day next month, at the same time', () => {
    expect(addMonth(at('2026-11-20T12:34:56.789Z'))).toBe(at('2026-12-20T12:34:56.789Z'));
    expect(addMonth(at('2026-12-20T00:00:00Z'))).toBe(at('2027-01-20T00:00:00Z'));
  });

  it('renew on the anchor day, so a short month never moves the day for good', () => {
    // Taken on the 31st of January: the 28th of February, then the 31st of March, not the 28th.
    const jan = at('2027-01-31T10:00:00Z');
    expect(anchorDayOf(jan)).toBe(31);
    const feb = addMonth(jan, 31);
    expect(feb).toBe(at('2027-02-28T10:00:00Z'));
    const mar = addMonth(feb, 31);
    expect(mar).toBe(at('2027-03-31T10:00:00Z'));
    expect(addMonth(mar, 31)).toBe(at('2027-04-30T10:00:00Z'));
    // Without the anchor the day slides, which is what the anchor is kept for.
    expect(addMonth(feb)).toBe(at('2027-03-28T10:00:00Z'));
    expect(addMonth(at('2026-11-20T00:00:00Z'), 20)).toBe(at('2026-12-20T00:00:00Z'));
  });

  it('ignore an anchor that is not a day of a month', () => {
    const from = at('2026-11-20T00:00:00Z');
    for (const anchor of [0, 32, 1.5, Number.NaN]) {
      expect(addMonth(from, anchor)).toBe(at('2026-12-20T00:00:00Z'));
    }
  });

  it("hold a day a shorter month lacks to that month's last day", () => {
    expect(addMonth(at('2027-01-31T10:00:00Z'))).toBe(at('2027-02-28T10:00:00Z'));
    expect(addMonth(at('2028-01-31T10:00:00Z'))).toBe(at('2028-02-29T10:00:00Z'));
    expect(addMonth(at('2026-10-31T10:00:00Z'))).toBe(at('2026-11-30T10:00:00Z'));
    expect(addMonth(at('2026-08-31T10:00:00Z'))).toBe(at('2026-09-30T10:00:00Z'));
  });
});
