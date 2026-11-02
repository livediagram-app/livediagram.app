import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  dateTimeText,
  dateTimeZones,
  fromLocalInput,
  instantIso,
  instantOnDay,
  instantValue,
  isInstantValue,
  isTimeZone,
  localInputValue,
  parseDateTime,
  readInstant,
  shiftInstant,
  TIMED_DEFAULT_HOUR,
  timeOfDayText,
  viewerZone,
  zonedDay,
  zonedInstant,
  zonedParts,
} from './date-time-fields';
import { dayNumber } from './plan-view-dates';

// Date and Time fields (docs/specs/026-plan/item-types.md "Date and Time"): stored as UTC with the zone it was set in,
// read in each viewer's zone, across time zones and clock changes.

const LONDON = 'Europe/London';
const NEW_YORK = 'America/New_York';
const TOKYO = 'Asia/Tokyo';
const day = (iso: string) => dayNumber(iso)!;

describe('storing a moment', () => {
  it('keeps the UTC instant to the minute, then the zone it was set in', () => {
    const ms = Date.UTC(2026, 9, 31, 17, 0, 42, 500);
    expect(instantValue(ms)).toBe('2026-10-31T17:00:00Z');
    expect(instantValue(ms, LONDON)).toBe('2026-10-31T17:00:00Z[Europe/London]');
  });

  it('reads any ISO 8601 time with its offset, and the zone in brackets', () => {
    expect(readInstant('2026-10-31T17:00:00Z')).toEqual({ ms: Date.UTC(2026, 9, 31, 17) });
    expect(readInstant('2026-10-31T17:00:00Z[Europe/London]')).toEqual({
      ms: Date.UTC(2026, 9, 31, 17),
      zone: LONDON,
    });
    // An offset, with or without its colon, seconds and a fraction, a space for the T.
    expect(readInstant('2026-10-31T18:00+01:00')?.ms).toBe(Date.UTC(2026, 9, 31, 17));
    expect(readInstant('2026-10-31 12:00:30.250-0500')?.ms).toBe(Date.UTC(2026, 9, 31, 17));
    expect(readInstant('2026-10-31T22:30+05')?.ms).toBe(Date.UTC(2026, 9, 31, 17, 30));
    // A zone the runtime doesn't know is dropped, never refused.
    expect(readInstant('2026-10-31T17:00Z[Mars/Olympus]')).toEqual({
      ms: Date.UTC(2026, 9, 31, 17),
    });
  });

  it('refuses what is no moment', () => {
    for (const bad of [
      '2026-10-31',
      '2026-10-31T17:00',
      '2026-02-30T10:00Z',
      '2026-10-31T24:00Z',
      '2026-10-31T17:60Z',
      '2026-10-31T17:00:61Z',
      '0999-10-31T17:00Z',
      '2026-10-31T17:00+19:00',
      'tomorrow',
      42,
      null,
    ])
      expect(readInstant(bad), String(bad)).toBeUndefined();
    expect(isInstantValue('2026-10-31T17:00Z')).toBe(true);
    expect(isInstantValue('2026-10-31')).toBe(false);
  });

  it('checks a zone once, and names the viewer’s', () => {
    expect(isTimeZone(TOKYO)).toBe(true);
    expect(isTimeZone(TOKYO)).toBe(true);
    expect(isTimeZone('Nowhere/Land')).toBe(false);
    expect(isTimeZone(viewerZone())).toBe(true);
  });
});

describe('writing a moment', () => {
  it('needs the offset from an agent, stored as UTC', () => {
    expect(parseDateTime('2026-10-31T13:00:00-04:00')).toBe('2026-10-31T17:00:00Z');
    expect(parseDateTime(' 2026-10-31T17:00Z[Europe/London] ')).toBe(
      '2026-10-31T17:00:00Z[Europe/London]',
    );
    expect(parseDateTime('2026-10-31T17:00')).toBeUndefined();
  });

  it('reads a time with no offset in the importer’s zone when local', () => {
    const local = parseDateTime('2026-10-31 17:00', { local: true })!;
    expect(local).toBe(instantValue(new Date(2026, 9, 31, 17, 0).getTime(), viewerZone()));
    // A bracketed zone says which zone the wall-clock time is in.
    expect(parseDateTime('2026-07-01T09:00[America/New_York]', { local: true })).toBe(
      '2026-07-01T13:00:00Z[America/New_York]',
    );
  });

  it('gives agents and CSV the UTC instant, zone left out', () => {
    expect(instantIso('2026-10-31T17:00:00Z[Europe/London]')).toBe('2026-10-31T17:00:00Z');
    expect(instantIso('2026-10-31')).toBeUndefined();
  });

  // The pattern has one place for each part, so a long input is read once, never backtracked over.
  it('stays linear on long hostile input', () => {
    const worst = `2026-10-31T17:00:00${'0'.repeat(50_000)}x`;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) readInstant(worst);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('time zones', () => {
  const at = Date.UTC(2026, 9, 31, 17, 0);

  it('reads the wall-clock time in each zone', () => {
    expect(zonedParts(at, LONDON)).toEqual({ year: 2026, month: 9, date: 31, hour: 17, minute: 0 });
    expect(zonedParts(at, NEW_YORK).hour).toBe(13);
    expect(zonedParts(at, TOKYO)).toMatchObject({ date: 1, month: 10, hour: 2 });
    // The runtime's own zone through the Date getters.
    const local = new Date(at);
    expect(zonedParts(at)).toEqual({
      year: local.getFullYear(),
      month: local.getMonth(),
      date: local.getDate(),
      hour: local.getHours(),
      minute: local.getMinutes(),
    });
  });

  it('puts a moment on the viewer’s own day', () => {
    // 17:00 London on Saturday 31 October is Sunday 1 November in Tokyo.
    expect(zonedDay(at, LONDON)).toBe(day('2026-10-31'));
    expect(zonedDay(at, TOKYO)).toBe(day('2026-11-01'));
    expect(dayNumber('2026-10-31T17:00:00Z', TOKYO)).toBe(day('2026-11-01'));
    expect(dayNumber('2026-10-31T17:00:00Z', NEW_YORK)).toBe(day('2026-10-31'));
  });

  it('finds the moment of a wall-clock time, in a zone or the runtime’s', () => {
    expect(zonedInstant(day('2026-10-31'), 17, 0, LONDON)).toBe(at);
    expect(zonedInstant(day('2026-10-31'), 13, 0, NEW_YORK)).toBe(at);
    expect(zonedInstant(day('2026-10-31'), 17, 0)).toBe(new Date(2026, 9, 31, 17, 0).getTime());
  });

  it('moves a skipped time forward and takes the first of a repeated one', () => {
    // London springs forward at 01:00 on 29 March 2026: 01:30 never happens, so it is 02:30 BST.
    expect(zonedInstant(day('2026-03-29'), 1, 30, LONDON)).toBe(Date.UTC(2026, 2, 29, 1, 30));
    // London falls back at 02:00 on 25 October 2026: 01:30 happens twice; the first is BST.
    expect(zonedInstant(day('2026-10-25'), 1, 30, LONDON)).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });
});

describe('moving a moment by days', () => {
  it('keeps its time of day across a clock change', () => {
    // A 09:00 London meeting on Friday 23 October (BST) dragged to Monday 26 October (GMT) is still 09:00.
    const moved = shiftInstant('2026-10-23T08:00:00Z[Europe/London]', 3, LONDON)!;
    expect(moved).toBe('2026-10-26T09:00:00Z[Europe/London]');
    expect(zonedParts(readInstant(moved)!.ms, LONDON).hour).toBe(9);
    // New York's own change, a week later, kept the same way.
    expect(shiftInstant('2026-10-30T13:00:00Z', 3, NEW_YORK)).toBe('2026-11-02T14:00:00Z');
    expect(shiftInstant('not a time', 1)).toBeUndefined();
  });

  it('lands on a day keeping its time, or at the default hour when it had none', () => {
    // A moment set with no zone takes the mover's.
    expect(instantOnDay('2026-10-23T08:00:00Z', day('2026-11-02'), LONDON)).toBe(
      '2026-11-02T09:00:00Z[Europe/London]',
    );
    expect(TIMED_DEFAULT_HOUR).toBe(9);
    expect(instantOnDay(undefined, day('2026-07-01'), NEW_YORK)).toBe(
      '2026-07-01T13:00:00Z[America/New_York]',
    );
    expect(instantOnDay(undefined, day('2026-07-01'))).toBe(
      instantValue(new Date(2026, 6, 1, 9, 0).getTime(), viewerZone()),
    );
  });
});

describe('the date-and-time box', () => {
  it('shows and reads the moment in the viewer’s zone', () => {
    expect(localInputValue('2026-10-31T17:00:00Z', NEW_YORK)).toBe('2026-10-31T13:00');
    expect(localInputValue('', NEW_YORK)).toBe('');
    expect(fromLocalInput('2026-10-31T13:00', NEW_YORK)).toBe(
      '2026-10-31T17:00:00Z[America/New_York]',
    );
    expect(fromLocalInput('2026-10-31T17:00')).toBe(
      instantValue(new Date(2026, 9, 31, 17, 0).getTime(), viewerZone()),
    );
    for (const part of ['2026-10-31', '2026-02-30T10:00', '0201-10-31T10:00', '2026-10-31T25:00'])
      expect(fromLocalInput(part, LONDON), part).toBeUndefined();
  });
});

describe('showing a moment', () => {
  const now = Date.UTC(2026, 9, 1);

  it('reads short on a card and whole in the panel, in the viewer’s zone', () => {
    const v = '2026-10-31T17:00:00Z';
    const short = dateTimeText(v, 'short', { tz: LONDON, now })!;
    expect(short).toContain('31');
    // 17:00 on a 24-hour clock, 05:00 PM on a 12-hour one (CI runs en-US).
    expect(short).toMatch(/17|0?5:00/);
    expect(short).not.toContain('2026');
    expect(dateTimeText(v, 'medium', { tz: LONDON, now })).toContain('2026');
    // Another year shows its year even on a card.
    expect(dateTimeText('2027-01-04T09:00:00Z', 'short', { tz: LONDON, now })).toContain('2027');
    // New York sees 13:00.
    expect(dateTimeText(v, 'short', { tz: NEW_YORK, now })).toMatch(/1:00|13/);
    expect(dateTimeText('nope')).toBeNull();
    expect(dateTimeText(v)).toBeTruthy();
    expect(timeOfDayText(Date.UTC(2026, 9, 31, 17), LONDON)).toMatch(/17|5/);
    expect(timeOfDayText(Date.UTC(2026, 9, 31, 17))).toBeTruthy();
  });

  it('names the viewer’s zone, and where it was set when that is another', () => {
    const set = '2026-10-31T17:00:00Z[America/New_York]';
    const zones = dateTimeZones(set, LONDON)!;
    expect(zones).toMatch(/^Your time, Europe\/London · Set as .* in America\/New_York$/);
    expect(zones).toMatch(/1:00|13/);
    expect(dateTimeZones(set, NEW_YORK)).toBe('Your time, America/New_York');
    expect(dateTimeZones('2026-10-31T17:00:00Z', LONDON)).toBe('Your time, Europe/London');
    expect(dateTimeZones('2026-10-31T17:00:00Z')).toBe(`Your time, ${viewerZone()}`);
    expect(dateTimeZones(undefined)).toBeNull();
  });
});
