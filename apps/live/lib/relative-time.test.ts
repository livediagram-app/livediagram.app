import { describe, expect, it } from 'vitest';
import { formatRelativeTime, formatRelativeTimeShort } from './relative-time';

// Both formatters take a millisecond delta and walk the same threshold
// ladder (just now → secs → mins → hours → yesterday → days). We pin
// each boundary so a regression in any single branch is caught.

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeTime (verbose)', () => {
  it('reads "just now" under 5 seconds', () => {
    expect(formatRelativeTime(0)).toBe('just now');
    expect(formatRelativeTime(4 * SEC)).toBe('just now');
  });

  it('switches to seconds at the 5s boundary', () => {
    expect(formatRelativeTime(5 * SEC)).toBe('5 secs ago');
    expect(formatRelativeTime(59 * SEC)).toBe('59 secs ago');
  });

  it('singularises one minute and pluralises the rest', () => {
    expect(formatRelativeTime(MIN)).toBe('1 min ago');
    expect(formatRelativeTime(2 * MIN)).toBe('2 mins ago');
    expect(formatRelativeTime(59 * MIN)).toBe('59 mins ago');
  });

  it('singularises one hour and pluralises the rest', () => {
    expect(formatRelativeTime(HOUR)).toBe('1 hour ago');
    expect(formatRelativeTime(2 * HOUR)).toBe('2 hours ago');
    expect(formatRelativeTime(23 * HOUR)).toBe('23 hours ago');
  });

  it('says "yesterday" at one day, then counts days', () => {
    expect(formatRelativeTime(DAY)).toBe('yesterday');
    expect(formatRelativeTime(2 * DAY)).toBe('2 days ago');
    expect(formatRelativeTime(10 * DAY)).toBe('10 days ago');
  });

  it('floors partial units rather than rounding', () => {
    // 1 min 59 sec → still "1 min ago", not "2 mins ago".
    expect(formatRelativeTime(MIN + 59 * SEC)).toBe('1 min ago');
    // 1 hour 59 min → still "1 hour ago".
    expect(formatRelativeTime(HOUR + 59 * MIN)).toBe('1 hour ago');
  });
});

describe('formatRelativeTimeShort (compact)', () => {
  it('reads "just now" under 5 seconds', () => {
    expect(formatRelativeTimeShort(0)).toBe('just now');
    expect(formatRelativeTimeShort(4 * SEC)).toBe('just now');
  });

  it('uses the terse "Ns ago" form for seconds', () => {
    expect(formatRelativeTimeShort(5 * SEC)).toBe('5s ago');
    expect(formatRelativeTimeShort(59 * SEC)).toBe('59s ago');
  });

  it('uses "min" for minutes (no plural "mins")', () => {
    expect(formatRelativeTimeShort(MIN)).toBe('1 min ago');
    expect(formatRelativeTimeShort(2 * MIN)).toBe('2 min ago');
    expect(formatRelativeTimeShort(59 * MIN)).toBe('59 min ago');
  });

  it('matches the verbose form for hours and days', () => {
    expect(formatRelativeTimeShort(HOUR)).toBe('1 hour ago');
    expect(formatRelativeTimeShort(5 * HOUR)).toBe('5 hours ago');
    expect(formatRelativeTimeShort(DAY)).toBe('yesterday');
    expect(formatRelativeTimeShort(3 * DAY)).toBe('3 days ago');
  });
});
