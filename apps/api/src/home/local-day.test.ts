import { describe, expect, it } from 'vitest';
import { localDay, parseTimeZone } from './local-day';

// The reader's day (docs/specs/013-workspace/explorer-home.md "What happened"): groups and day
// headings follow the person's time zone; opens are counted per UTC day.

// 2023-11-14 22:13:20 UTC.
const AT = 1_700_000_000_000;

describe('parseTimeZone', () => {
  it('defaults to UTC when none is sent', () => {
    expect(parseTimeZone(null)).toBe('UTC');
  });

  it('accepts an IANA name', () => {
    expect(parseTimeZone('Europe/Amsterdam')).toBe('Europe/Amsterdam');
    expect(parseTimeZone('Pacific/Auckland')).toBe('Pacific/Auckland');
  });

  it('refuses a name Intl does not know, an empty one, or an overlong one', () => {
    expect(parseTimeZone('Mars/Olympus_Mons')).toBeNull();
    expect(parseTimeZone('')).toBeNull();
    expect(parseTimeZone(`Europe/${'x'.repeat(80)}`)).toBeNull();
  });
});

describe('localDay', () => {
  it('names the calendar day in the zone', () => {
    expect(localDay(AT, 'UTC')).toBe('2023-11-14');
    expect(localDay(AT, 'Europe/Amsterdam')).toBe('2023-11-14');
    expect(localDay(AT, 'Pacific/Auckland')).toBe('2023-11-15');
    expect(localDay(AT, 'America/Los_Angeles')).toBe('2023-11-14');
  });
});
