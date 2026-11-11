import { describe, expect, it } from 'vitest';
import {
  clockMinutes,
  clockWords,
  firesOn,
  latestMissed,
  momentOn,
  nextMoment,
  type AutomationTimeTrigger,
} from './schedule';
import { clockMoment } from '../repeat-dates';

// docs/specs/026-plan/automations.md "Time triggers" (whose time it is, once per moment, late never a burst);
// blueprint automations.md "Phase 2" (nextMoment / latestMissed, the clock-change rules).
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const at = (s: string) => Date.parse(s);
const LONDON = 'Europe/London';
const NEW_YORK = 'America/New_York';
const daily = (time = '09:00'): AutomationTimeTrigger => ({
  kind: 'scheduled',
  every: 'day',
  at: time,
});
const HOUR = 3_600_000;

describe('a rule time', () => {
  it('reads quarter hours only', () => {
    expect(clockMinutes('09:15')).toBe(555);
    expect(clockMinutes('23:45')).toBe(1425);
    for (const bad of ['9:00', '09:10', '24:00', '', 5, null]) expect(clockMinutes(bad)).toBeNull();
  });

  it('says the hour without its leading zero', () => {
    expect(clockWords('09:00')).toBe('9:00');
    expect(clockWords('17:45')).toBe('17:45');
  });
});

describe('the days a trigger falls on', () => {
  it('follows a Repeat: weekdays, chosen days, a day of the month past its end its last', () => {
    expect(firesOn({ kind: 'scheduled', every: 'weekday', at: '09:00' }, '2026-11-14')).toBe(false);
    expect(firesOn({ kind: 'scheduled', every: 'weekday', at: '09:00' }, '2026-11-16')).toBe(true);
    const monThu: AutomationTimeTrigger = {
      kind: 'scheduled',
      every: 'week',
      days: [1, 4],
      at: '17:30',
    };
    expect(['2026-11-16', '2026-11-17', '2026-11-19'].map((d) => firesOn(monThu, d))).toEqual([
      true,
      false,
      true,
    ]);
    const the31st: AutomationTimeTrigger = {
      kind: 'scheduled',
      every: 'month',
      dayOfMonth: 31,
      at: '09:00',
    };
    expect(firesOn(the31st, '2026-04-30')).toBe(true);
    expect(firesOn(the31st, '2026-04-29')).toBe(false);
    expect(firesOn(the31st, '2026-05-31')).toBe(true);
  });

  it('has Due In and Overdue look every day', () => {
    expect(firesOn({ kind: 'due_in', days: 2, at: '09:00' }, '2026-11-15')).toBe(true);
    expect(firesOn({ kind: 'overdue', at: '09:00' }, '2026-11-15')).toBe(true);
  });
});

describe('nextMoment', () => {
  it('is the first moment after, in the rule’s time zone', () => {
    expect(iso(nextMoment(daily(), LONDON, at('2026-11-11T10:42:00Z')))).toBe(
      '2026-11-12T09:00:00.000Z',
    );
    // Before today's moment: today's.
    expect(iso(nextMoment(daily(), LONDON, at('2026-11-11T08:00:00Z')))).toBe(
      '2026-11-11T09:00:00.000Z',
    );
    // Exactly at it: the next one, never the same moment twice.
    expect(iso(nextMoment(daily(), LONDON, at('2026-11-11T09:00:00Z')))).toBe(
      '2026-11-12T09:00:00.000Z',
    );
    // Summer time: 9:00 in London is 8:00 UTC.
    expect(iso(nextMoment(daily(), LONDON, at('2026-07-01T12:00:00Z')))).toBe(
      '2026-07-02T08:00:00.000Z',
    );
    expect(iso(nextMoment(daily(), NEW_YORK, at('2026-11-11T12:00:00Z')))).toBe(
      '2026-11-11T14:00:00.000Z',
    );
  });

  it('skips the weekend for a weekday rule', () => {
    const weekday: AutomationTimeTrigger = { kind: 'scheduled', every: 'weekday', at: '09:00' };
    expect(iso(nextMoment(weekday, LONDON, at('2026-11-13T10:00:00Z')))).toBe(
      '2026-11-16T09:00:00.000Z',
    );
  });

  it('runs a monthly 31st on the 30th of April', () => {
    const the31st: AutomationTimeTrigger = {
      kind: 'scheduled',
      every: 'month',
      dayOfMonth: 31,
      at: '09:00',
    };
    expect(iso(nextMoment(the31st, LONDON, at('2026-04-01T00:00:00Z')))).toBe(
      '2026-04-30T08:00:00.000Z',
    );
    expect(iso(nextMoment(the31st, LONDON, at('2026-04-30T09:00:00Z')))).toBe(
      '2026-05-31T08:00:00.000Z',
    );
  });

  it('runs a time the clocks skip at the first minute after the change', () => {
    // London springs forward at 01:00 GMT on 29 March 2026: 01:30 never comes, 02:00 BST is the first after.
    expect(iso(nextMoment(daily('01:30'), LONDON, at('2026-03-28T12:00:00Z')))).toBe(
      '2026-03-29T01:00:00.000Z',
    );
    // New York springs forward at 02:00 EST on 8 March 2026: 02:30 runs at 03:00 EDT.
    expect(iso(nextMoment(daily('02:30'), NEW_YORK, at('2026-03-07T12:00:00Z')))).toBe(
      '2026-03-08T07:00:00.000Z',
    );
    // The day after, back to the time itself.
    expect(iso(nextMoment(daily('02:30'), NEW_YORK, at('2026-03-08T07:00:00Z')))).toBe(
      '2026-03-09T06:30:00.000Z',
    );
  });

  it('runs a time the clocks repeat once, at the first', () => {
    // London falls back at 02:00 BST on 25 October 2026: 01:30 comes at 00:30 UTC and again at 01:30 UTC.
    const first = nextMoment(daily('01:30'), LONDON, at('2026-10-24T12:00:00Z'));
    expect(iso(first)).toBe('2026-10-25T00:30:00.000Z');
    // After it, the second 01:30 is not another moment: the next is the next day's.
    expect(iso(nextMoment(daily('01:30'), LONDON, first!))).toBe('2026-10-26T01:30:00.000Z');
    // New York falls back at 02:00 EDT on 1 November 2026: 01:30 EDT, not 01:30 EST.
    const ny = nextMoment(daily('01:30'), NEW_YORK, at('2026-10-31T12:00:00Z'));
    expect(iso(ny)).toBe('2026-11-01T05:30:00.000Z');
    expect(iso(nextMoment(daily('01:30'), NEW_YORK, ny!))).toBe('2026-11-02T06:30:00.000Z');
  });

  it('answers null for a rule that never falls on a day', () => {
    const never: AutomationTimeTrigger = {
      kind: 'scheduled',
      every: 'week',
      days: [],
      at: '09:00',
    };
    expect(nextMoment(never, LONDON, at('2026-11-11T00:00:00Z'))).toBeNull();
  });

  it('places the moment on its day, whatever the trigger', () => {
    expect(iso(momentOn({ kind: 'overdue', at: '09:00' }, '2026-11-11', LONDON))).toBe(
      '2026-11-11T09:00:00.000Z',
    );
    expect(clockMoment('2026-11-11', 0, 'UTC')).toBe(at('2026-11-11T00:00:00Z'));
  });
});

describe('latestMissed', () => {
  const since = at('2026-11-08T09:00:00Z');

  it('runs only the latest moment missed, once', () => {
    // Three days' 9:00s missed: only today's runs.
    expect(iso(latestMissed(daily(), LONDON, since, at('2026-11-11T10:00:00Z')))).toBe(
      '2026-11-11T09:00:00.000Z',
    );
    // Before today's moment, yesterday's is the latest.
    expect(iso(latestMissed(daily(), LONDON, since, at('2026-11-11T08:00:00Z')))).toBe(
      '2026-11-10T09:00:00.000Z',
    );
  });

  it('finds none when no day of the last three is one of the rule’s', () => {
    const mondays: AutomationTimeTrigger = {
      kind: 'scheduled',
      every: 'week',
      days: [1],
      at: '09:00',
    };
    expect(latestMissed(mondays, LONDON, since, at('2026-11-12T10:00:00Z'))).toBeNull();
  });

  it('runs nothing already run', () => {
    expect(
      latestMissed(daily(), LONDON, at('2026-11-11T09:00:00Z'), at('2026-11-11T10:00:00Z')),
    ).toBeNull();
  });

  it('drops a moment more than a day late', () => {
    const weekly: AutomationTimeTrigger = {
      kind: 'scheduled',
      every: 'week',
      days: [1],
      at: '09:00',
    };
    // Monday's 9:00 (16 November), woken on Tuesday at 9:15: more than a day late.
    expect(
      latestMissed(weekly, LONDON, since, at('2026-11-17T09:00:00Z') + 15 * 60_000),
    ).toBeNull();
    // On Tuesday at 8:45, still within the day.
    expect(iso(latestMissed(weekly, LONDON, since, at('2026-11-17T09:00:00Z') - 15 * 60_000))).toBe(
      '2026-11-16T09:00:00.000Z',
    );
    // A weekend wake for a weekday rule finds Friday's, and drops it.
    const weekday: AutomationTimeTrigger = { kind: 'scheduled', every: 'weekday', at: '09:00' };
    expect(latestMissed(weekday, LONDON, since, at('2026-11-15T10:00:00Z'))).toBeNull();
    // A day of exactly 24 hours late still runs.
    expect(iso(latestMissed(daily(), LONDON, since, at('2026-11-10T09:00:00Z') + 24 * HOUR))).toBe(
      '2026-11-11T09:00:00.000Z',
    );
  });
});

describe('a stored time that is not one', () => {
  it('reads as midnight rather than throwing', () => {
    expect(iso(momentOn({ kind: 'overdue', at: 'soon' }, '2026-11-11', 'UTC'))).toBe(
      '2026-11-11T00:00:00.000Z',
    );
  });
});
