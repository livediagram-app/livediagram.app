import { describe, expect, it } from 'vitest';
import {
  RECURRENCE_SEARCH_DAYS,
  ZONE_CACHE_MAX,
  addDays,
  clockMoment,
  dayKey,
  dayNo,
  dayNumber,
  dayStart,
  dayText,
  dayWords,
  daysInMonth,
  isDay,
  isRuleTimeZone,
  localDay,
  occursOn,
  weekdayOf,
  zonedClock,
} from './dates';

const iso = (ms: number) => new Date(ms).toISOString();

describe('days', () => {
  it('reads a real day and nothing else', () => {
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(isDay('2026-11-11')).toBe(true);
    for (const bad of ['2026-02-31', '2026-13-01', '2026-00-10', '2026-01-00', 'soon', 5, null])
      expect(isDay(bad)).toBe(false);
    expect(dayNo('nonsense')).toBe(0);
  });

  it('adds days across a month and a year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayKey(dayNo('2028-02-29'))).toBe('2028-02-29');
  });

  it('counts a month, December into the next year', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 11)).toBe(31);
  });

  it('counts weekdays from Sunday', () => {
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(weekdayOf('2026-11-07')).toBe(6);
  });

  it('says a day in words, and anything else as it is', () => {
    expect(dayText('2026-11-11')).toBe('11 Nov 2026');
    expect(dayText('someday')).toBe('someday');
    expect(dayWords(0)).toBe('1 Jan 1970');
  });
});

describe('time zones', () => {
  it('knows a zone the runtime knows, bounded first', () => {
    expect(isRuleTimeZone('Europe/London')).toBe(true);
    expect(isRuleTimeZone('Mars/Olympus')).toBe(false);
    for (const bad of ['', 'x'.repeat(65), 5, undefined]) expect(isRuleTimeZone(bad)).toBe(false);
  });

  it('keeps a bounded number of formatters', () => {
    const zones = Intl.supportedValuesOf('timeZone').slice(0, ZONE_CACHE_MAX + 5);
    for (const zone of zones) expect(localDay(0, zone)).toMatch(/^19(69|70)-/);
    // The first zones were let go and read again all the same.
    expect(localDay(0, zones[0]!)).toMatch(/^19(69|70)-/);
  });

  it('reads the wall clock and the day somewhere', () => {
    const at = Date.parse('2026-11-11T23:30:45Z');
    expect(zonedClock(at, 'UTC')).toEqual({ y: 2026, m: 11, d: 11, h: 23, min: 30, s: 45 });
    expect(localDay(at, 'Asia/Tokyo')).toBe('2026-11-12');
    expect(zonedClock(Date.parse('2026-11-11T00:00:00Z'), 'UTC').h).toBe(0);
  });

  it('finds where a day starts, a skipped midnight too', () => {
    expect(iso(dayStart('2026-11-11', 'Europe/London'))).toBe('2026-11-11T00:00:00.000Z');
    expect(iso(dayStart('2026-07-01', 'Europe/London'))).toBe('2026-06-30T23:00:00.000Z');
    // Santiago's clocks go forward at midnight: the day starts at 01:00.
    expect(iso(dayStart('2026-09-06', 'America/Santiago'))).toBe('2026-09-06T04:00:00.000Z');
  });

  it('finds the moment a clock reads a time: once when repeated, after the change when skipped', () => {
    expect(iso(clockMoment('2026-11-11', 9 * 60, 'Europe/London'))).toBe(
      '2026-11-11T09:00:00.000Z',
    );
    // 01:30 comes twice on the day the clocks go back: the first.
    expect(iso(clockMoment('2026-10-25', 90, 'Europe/London'))).toBe('2026-10-25T00:30:00.000Z');
    // 01:30 never comes on the day they go forward: the first minute after.
    expect(iso(clockMoment('2026-03-29', 90, 'Europe/London'))).toBe('2026-03-29T01:00:00.000Z');
  });
});

describe('a recurrence', () => {
  it('falls on every day, weekdays, chosen days, or a day of the month (its last, past the end)', () => {
    expect(occursOn({ every: 'day' }, '2026-11-14')).toBe(true);
    expect(occursOn({ every: 'weekday' }, '2026-11-13')).toBe(true);
    expect(occursOn({ every: 'weekday' }, '2026-11-14')).toBe(false);
    expect(occursOn({ every: 'weekday' }, '2026-11-15')).toBe(false);
    expect(occursOn({ every: 'week', days: [1, 4] }, '2026-11-12')).toBe(true);
    expect(occursOn({ every: 'week' }, '2026-11-12')).toBe(false);
    expect(occursOn({ every: 'month', date: 31 }, '2026-02-28')).toBe(true);
    expect(occursOn({ every: 'month' }, '2026-02-01')).toBe(true);
    expect(occursOn({ every: 'month', date: 15 }, '2026-02-01')).toBe(false);
    expect(RECURRENCE_SEARCH_DAYS).toBe(400);
  });
});
