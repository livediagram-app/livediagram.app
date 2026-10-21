import { describe, expect, it } from 'vitest';
import {
  dateFromSerial,
  localeDayFirst,
  parseDateText,
  parseTimeText,
  serialFromDate,
  serialFromMs,
} from './dates';

describe('serials', () => {
  it('counts from 30 December 1899', () => {
    expect(serialFromDate(1899, 12, 30)).toBe(0);
    expect(serialFromDate(1900, 1, 1)).toBe(2);
    expect(serialFromDate(2026, 10, 8)).toBe(46303);
    expect(serialFromMs(Date.UTC(2026, 9, 8, 12))).toBeCloseTo(46303.5);
  });
  it('round trips with time and leap days', () => {
    expect(dateFromSerial(serialFromDate(2024, 2, 29))).toMatchObject({ y: 2024, m: 2, d: 29 });
    const p = dateFromSerial(46303.75);
    expect(p).toMatchObject({ y: 2026, m: 10, d: 8, h: 18, min: 0, s: 0, weekday: 4 });
    // Drift just under midnight rounds to the next day, never 23:59:59.99.
    expect(dateFromSerial(46303.9999999999)).toMatchObject({ d: 9, h: 0 });
  });
});

describe('parsing', () => {
  it('reads times', () => {
    expect(parseTimeText('12:00 am')).toBe(0);
    expect(parseTimeText('12:00 PM')).toBe(0.5);
    expect(parseTimeText('13:00 pm')).toBeNull();
    expect(parseTimeText('24:00')).toBeNull();
    expect(parseTimeText('10:30:15')).toBeCloseTo((10 * 3600 + 30 * 60 + 15) / 86400);
  });
  it('reads dates', () => {
    expect(parseDateText('1/2/26', true)?.serial).toBe(serialFromDate(2026, 2, 1));
    expect(parseDateText('1/2/99', false)?.serial).toBe(serialFromDate(1999, 1, 2));
    expect(parseDateText('2026/10/08', true)?.serial).toBe(serialFromDate(2026, 10, 8));
    expect(parseDateText('8th September 2026', true)?.serial).toBe(serialFromDate(2026, 9, 8));
    expect(parseDateText('8 Sept 2026', true)?.serial).toBe(serialFromDate(2026, 9, 8));
    expect(parseDateText('8 Septx 2026', true)).toBeNull();
    expect(parseDateText('8 Ju 2026', true)).toBeNull();
    expect(parseDateText('1/2/123', true)).toBeNull();
    expect(parseDateText('2026-02-30', true)).toBeNull();
    expect(parseDateText('2026-10-08 nonsense', true)).toBeNull();
    expect(parseDateText('Feb 30 2026', true)).toBeNull();
    expect(parseDateText('nope', true)).toBeNull();
  });
  it('knows the locale order', () => {
    expect(localeDayFirst('en-GB')).toBe(true);
    expect(localeDayFirst('en-US')).toBe(false);
    expect(localeDayFirst('not a locale')).toBe(true);
  });
});
