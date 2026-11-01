import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  dateRangeText,
  isTimedRange,
  parseDateRange,
  pastDue,
  rangeDays,
  rangeEndOf,
  rangeIso,
  rangeValue,
  rangeWithEnd,
  readRange,
} from './date-range-fields';
import { cardDateOf } from './board-csv';
import { dayNumber } from './plan-view-dates';

// Date Range fields (docs/specs/026-plan/item-types.md "Date Range").

const TOKYO = 'Asia/Tokyo';
const LONDON = 'Europe/London';
const day = (iso: string) => dayNumber(iso)!;

describe('a stored range', () => {
  it('is two days or two moments, kept in order', () => {
    expect(readRange(['2026-10-31', '2026-11-02'])).toEqual({
      start: '2026-10-31',
      end: '2026-11-02',
      timed: false,
    });
    expect(readRange(['2026-11-02', '2026-10-31'])?.start).toBe('2026-10-31');
    expect(readRange(['2026-11-02T17:00:00Z', '2026-10-31T09:00:00Z'])).toEqual({
      start: '2026-10-31T09:00:00Z',
      end: '2026-11-02T17:00:00Z',
      timed: true,
    });
    for (const bad of [
      '2026-10-31',
      ['2026-10-31'],
      ['2026-10-31', '2026-11-02T09:00Z'],
      ['2026-10-31', 3],
      ['2026-02-30', '2026-03-01'],
      undefined,
    ])
      expect(readRange(bad as never), JSON.stringify(bad)).toBeUndefined();
    expect(rangeValue('2026-11-02', '2026-10-31')).toEqual(['2026-10-31', '2026-11-02']);
  });

  it('says whether its ends carry a time', () => {
    expect(isTimedRange({ kind: 'daterange', withTime: true })).toBe(true);
    expect(isTimedRange({ kind: 'daterange' })).toBe(false);
    expect(isTimedRange({ kind: 'date', withTime: true })).toBe(false);
  });
});

describe('a range’s ends', () => {
  it('gives each role its end', () => {
    const v = ['2026-10-31', '2026-11-02'];
    expect(rangeEndOf(v, 'start')).toBe('2026-10-31');
    expect(rangeEndOf(v, 'due')).toBe('2026-11-02');
    expect(rangeEndOf(undefined, 'due')).toBeUndefined();
  });

  it('sets one end, moving the other along when they cross, or both when there were none', () => {
    const v = ['2026-10-31', '2026-11-02'];
    expect(rangeWithEnd(v, 'start', '2026-11-01')).toEqual(['2026-11-01', '2026-11-02']);
    expect(rangeWithEnd(v, 'start', '2026-11-05')).toEqual(['2026-11-05', '2026-11-05']);
    expect(rangeWithEnd(v, 'due', '2026-11-04')).toEqual(['2026-10-31', '2026-11-04']);
    expect(rangeWithEnd(v, 'due', '2026-10-20')).toEqual(['2026-10-20', '2026-10-20']);
    expect(rangeWithEnd(undefined, 'due', '2026-10-20')).toEqual(['2026-10-20', '2026-10-20']);
  });

  it('falls on the viewer’s days when timed, and on its own days when not', () => {
    // 17:00 London on 31 October is 1 November in Tokyo.
    const timed = ['2026-10-31T17:00:00Z', '2026-11-02T10:00:00Z'];
    expect(rangeDays(timed, TOKYO)).toEqual({ start: day('2026-11-01'), end: day('2026-11-02') });
    expect(rangeDays(timed, LONDON)).toEqual({ start: day('2026-10-31'), end: day('2026-11-02') });
    const days = ['2026-10-31', '2026-11-02'];
    expect(rangeDays(days, TOKYO)).toEqual(rangeDays(days, LONDON));
    expect(rangeDays(undefined)).toBeUndefined();
  });
});

describe('writing a range', () => {
  it('stays linear on long runs of spaces', () => {
    const spaces = `2026-10-31${' '.repeat(50_000)}x`;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) expect(parseDateRange(spaces, false)).toBeUndefined();
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('reads an ISO 8601 interval, " to ", or a list of its two ends', () => {
    expect(parseDateRange('2026-10-31/2026-11-02', false)).toEqual(['2026-10-31', '2026-11-02']);
    expect(parseDateRange('2026-11-02 to 2026-10-31', false)).toEqual(['2026-10-31', '2026-11-02']);
    expect(parseDateRange(['2026-10-31', '2026-11-02'], false)).toEqual([
      '2026-10-31',
      '2026-11-02',
    ]);
    expect(parseDateRange('2026-10-31T09:00Z/2026-11-02T17:00+01:00', true)).toEqual([
      '2026-10-31T09:00:00Z',
      '2026-11-02T16:00:00Z',
    ]);
  });

  it('reads day-first days through the caller’s reader, split at " to "', () => {
    expect(
      parseDateRange('31/10/2026 to 2/11/2026', false, { readDay: (t) => cardDateOf(t) }),
    ).toEqual(['2026-10-31', '2026-11-02']);
  });

  it('refuses a range of the wrong shape', () => {
    for (const [input, timed] of [
      ['2026-10-31', false],
      ['2026-10-31/2026-11-02/2026-11-03', false],
      ['2026-10-31/2026-11-02T09:00Z', false],
      ['2026-10-31/2026-11-02', true],
      ['2026-10-31T09:00/2026-11-02T10:00', true],
      [['2026-10-31', 4], false],
      [42, false],
    ] as const)
      expect(parseDateRange(input, timed), JSON.stringify(input)).toBeUndefined();
    // Local times read in the importer's zone.
    expect(
      parseDateRange('2026-10-31 09:00 to 2026-10-31 17:00', true, { local: true }),
    ).toHaveLength(2);
  });

  it('gives agents and CSV an ISO 8601 interval', () => {
    expect(rangeIso(['2026-10-31', '2026-11-02'])).toBe('2026-10-31/2026-11-02');
    expect(rangeIso(['2026-10-31T09:00:00Z[Europe/London]', '2026-11-02T17:00:00Z'])).toBe(
      '2026-10-31T09:00:00Z/2026-11-02T17:00:00Z',
    );
    expect(rangeIso('nope')).toBeUndefined();
  });
});

describe('showing a range', () => {
  const now = Date.UTC(2026, 9, 1);

  it('reads "31 Oct to 2 Nov", one day as that day, years when not this year’s', () => {
    const text = dateRangeText(['2026-10-31', '2026-11-02'], 'short', { now })!;
    expect(text).toContain(' to ');
    expect(text).toContain('31');
    expect(text).not.toContain('2026');
    expect(dateRangeText(['2026-10-31', '2026-11-02'], 'medium', { now })).toContain('2026');
    expect(dateRangeText(['2026-10-31', '2026-10-31'], 'short', { now })).not.toContain(' to ');
    expect(dateRangeText(['2026-12-30', '2027-01-02'], 'short', { now })).toContain('2027');
    // A range of days reads the same in every zone.
    expect(dateRangeText(['2026-10-31', '2026-11-02'], 'short', { now, tz: TOKYO })).toBe(text);
    expect(dateRangeText(undefined)).toBeNull();
    expect(dateRangeText(['2026-10-31', '2026-11-02'])).toBeTruthy();
  });

  it('reads times in the viewer’s zone, the end as a time alone within one day', () => {
    const across = dateRangeText(['2026-10-31T09:00:00Z', '2026-11-02T17:00:00Z'], 'short', {
      tz: LONDON,
      now,
    })!;
    expect(across).toMatch(/09|9/);
    expect(across).toContain(' to ');
    const oneDay = dateRangeText(['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'], 'short', {
      tz: LONDON,
      now,
    })!;
    expect(oneDay.split(' to ')[1]).not.toContain('31');
    const instant = dateRangeText(['2026-10-31T09:00:00Z', '2026-10-31T09:00:00Z'], 'short', {
      tz: LONDON,
      now,
    })!;
    expect(instant).not.toContain(' to ');
  });
});

describe('past due', () => {
  const now = Date.UTC(2026, 9, 31, 17, 0);
  const DT = { kind: 'datetime' as const };
  const DR = { kind: 'daterange' as const };

  it('is a moment that has passed, to the minute', () => {
    expect(pastDue(DT, '2026-10-31T16:59:00Z', now)).toBe(true);
    expect(pastDue(DT, '2026-10-31T17:00:00Z[Europe/London]', now)).toBe(false);
    expect(pastDue(DT, 'nope', now)).toBe(false);
  });

  it('is a range whose end has passed: by the day for days, to the minute with times', () => {
    expect(pastDue(DR, ['2026-10-29', '2026-10-30'], now, LONDON)).toBe(true);
    expect(pastDue(DR, ['2026-10-29', '2026-10-31'], now, LONDON)).toBe(false);
    // 17:00 UTC on 31 October is already 1 November in Tokyo: a range ending on the 31st has passed there.
    expect(pastDue(DR, ['2026-10-29', '2026-10-31'], now, TOKYO)).toBe(true);
    expect(pastDue(DR, ['2026-10-31T09:00:00Z', '2026-10-31T16:00:00Z'], now)).toBe(true);
    expect(pastDue(DR, ['2026-10-31T09:00:00Z', '2026-10-31T18:00:00Z'], now)).toBe(false);
    expect(pastDue(DR, undefined, now)).toBe(false);
  });

  it('is never another kind, and reads the clock by default', () => {
    expect(pastDue({ kind: 'date' }, '2020-01-01', now)).toBe(false);
    expect(pastDue(DT, '2020-01-01T00:00:00Z')).toBe(true);
  });
});
