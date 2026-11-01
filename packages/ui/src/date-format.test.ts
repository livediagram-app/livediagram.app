import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dateFormat,
  DAY_LONG_MONTH,
  DAY_MONTH,
  DAY_MONTH_YEAR,
  MEDIUM_DATE,
  MEDIUM_DATE_TIME,
  MONTH_YEAR,
  TIME,
  TIME_SECONDS,
  WEEKDAY,
} from './date-format';

const AT = Date.UTC(2026, 10, 3, 14, 5, 9);

afterEach(() => vi.restoreAllMocks());

describe('dateFormat', () => {
  it('writes the date in the locale asked for, else the runtime’s (the browser’s)', () => {
    const f = dateFormat({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    expect(f.format(AT, 'en-GB')).toBe('3 Nov 2026');
    expect(f.format(AT, 'en-US')).toBe('Nov 3, 2026');
    expect(f.format(new Date(AT), 'de-DE')).toBe('3. Nov. 2026');
    expect(f.format(AT)).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(AT),
    );
    expect(f.formatToParts(AT, 'en-US').map((p) => p.type)).toEqual([
      'month',
      'literal',
      'day',
      'literal',
      'year',
    ]);
  });

  it('makes one formatter per locale, the first time, and never one per call', () => {
    const made = vi.spyOn(Intl, 'DateTimeFormat');
    const f = dateFormat({ day: 'numeric', month: 'short' });
    expect(made).not.toHaveBeenCalled();
    for (let k = 0; k < 3000; k++) f.format(AT + k * 60_000);
    expect(made).toHaveBeenCalledTimes(1);
    f.format(AT, 'en-US');
    f.formatToParts(AT, 'en-US');
    expect(made).toHaveBeenCalledTimes(2);
    expect(f.formatter('en-US')).toBe(f.formatter('en-US'));
    expect(f.formatter()).not.toBe(f.formatter('en-US'));
  });

  it('formats a 3,000-row list well inside a frame', () => {
    const started = performance.now();
    for (let k = 0; k < 3000; k++) MEDIUM_DATE_TIME.format(AT + k * 3_600_000);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('declares the shared formats once', () => {
    const gb = (f: { format: (at: number, locale?: string) => string }) => f.format(AT, 'en-GB');
    expect(gb(DAY_MONTH)).toBe('3 Nov');
    expect(gb(DAY_LONG_MONTH)).toBe('3 November');
    expect(gb(DAY_MONTH_YEAR)).toBe('3 Nov 2026');
    expect(gb(MONTH_YEAR)).toBe('November 2026');
    expect(gb(WEEKDAY)).toBe('Tuesday');
    expect(gb(MEDIUM_DATE)).toBe('3 Nov 2026');
    expect(gb(MEDIUM_DATE_TIME)).toMatch(/^3 Nov 2026, \d\d:\d\d$/);
    expect(gb(TIME)).toMatch(/^\d\d:\d\d$/);
    expect(gb(TIME_SECONDS)).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(TIME.format(AT, 'en-US')).toMatch(/^\d\d:\d\d [AP]M$/);
  });
});
