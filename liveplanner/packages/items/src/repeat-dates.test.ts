import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REPEAT_ZONE_CACHE_MAX,
  addDays,
  dayStart,
  isDay,
  isTimeZone,
  laterDay,
  localDay,
  weekdayOf,
} from './repeat-dates';

const at = (iso: string) => Date.parse(iso);

describe('repeat days', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-11-02T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('checks a day that exists', () => {
    expect(isDay('2026-11-02')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-04-31')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('2 Nov')).toBe(false);
    expect(isDay(20261102)).toBe(false);
  });

  it('adds days across months and years, and names the weekday from Sunday 0', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(weekdayOf('2026-11-02')).toBe(1);
    expect(weekdayOf('2026-02-28')).toBe(6);
    expect(laterDay('2026-11-02', '2026-11-01')).toBe('2026-11-02');
    expect(laterDay('', '2026-11-01')).toBe('2026-11-01');
  });

  it('knows the IANA zones and refuses the rest', () => {
    expect(isTimeZone('Europe/London')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
    expect(isTimeZone('')).toBe(false);
    expect(isTimeZone('x'.repeat(65))).toBe(false);
    expect(isTimeZone(1)).toBe(false);
  });

  it('reads the same instant as different days in different zones', () => {
    const now = Date.now();
    expect(localDay(now, 'Europe/London')).toBe('2026-11-02');
    expect(localDay(now, 'Pacific/Auckland')).toBe('2026-11-02');
    expect(localDay(at('2026-11-02T12:00:00Z'), 'Pacific/Auckland')).toBe('2026-11-03');
    expect(localDay(at('2026-11-02T05:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-01');
  });

  it('starts a day at its local midnight, either side of a clock change', () => {
    // London goes forward on 29 March 2026 at 01:00 UTC and back on 25 October at 01:00 UTC.
    expect(new Date(dayStart('2026-03-29', 'Europe/London')).toISOString()).toBe(
      '2026-03-29T00:00:00.000Z',
    );
    expect(new Date(dayStart('2026-03-30', 'Europe/London')).toISOString()).toBe(
      '2026-03-29T23:00:00.000Z',
    );
    expect(new Date(dayStart('2026-10-25', 'Europe/London')).toISOString()).toBe(
      '2026-10-24T23:00:00.000Z',
    );
    expect(new Date(dayStart('2026-10-26', 'Europe/London')).toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    );
    expect(new Date(dayStart('2026-11-02', 'Pacific/Auckland')).toISOString()).toBe(
      '2026-11-01T11:00:00.000Z',
    );
    expect(new Date(dayStart('2026-11-02', 'America/New_York')).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('starts a day whose midnight a clock change skips when the day does', () => {
    // Santiago and Havana move their clocks at midnight: the day starts at 01:00 there.
    for (const [zone, days] of [
      ['America/Santiago', ['2026-09-06', '2026-04-05', '2026-11-02']],
      ['America/Havana', ['2026-03-08', '2026-11-01']],
      ['Asia/Beirut', ['2026-03-29', '2026-10-25']],
    ] as const) {
      for (const day of days) {
        const start = dayStart(day, zone);
        expect(localDay(start, zone)).toBe(day);
        expect(localDay(start - 1000, zone) < day).toBe(true);
      }
    }
  });

  it('keeps a bounded number of zone formatters', () => {
    const zones = Intl.supportedValuesOf('timeZone').slice(0, REPEAT_ZONE_CACHE_MAX + 5);
    for (const z of zones) expect(isTimeZone(z)).toBe(true);
    // The first ones were dropped and are made again on demand.
    expect(localDay(Date.now(), zones[0]!)).toMatch(/^2026-11-0[123]$/);
  });
});
