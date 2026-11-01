import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateFields } from './fields';
import { ITEM_TYPES } from './item-types';
import { REPEAT_REFUSAL, resolveFields } from './plan-names';
import {
  REPEAT_FIELD,
  hasRepeat,
  itemRepeat,
  latestOccurrence,
  nextOccurrence,
  occursOn,
  previousOccurrence,
  readRepeatRule,
  repeatChanged,
  repeatNext,
  repeatSchedule,
  settledFloor,
  type RepeatRule,
} from './repeat';
import { dayWords, listWords, ordinal, repeatRuleWords } from './repeat-words';
import { item } from './test-items';

const at = (iso: string) => Date.parse(iso);
const LONDON = 'Europe/London';
const rule = (r: Partial<RepeatRule>): RepeatRule => ({
  every: 'day',
  from: '2026-11-02',
  timeZone: LONDON,
  ...r,
});

beforeEach(() => {
  vi.useFakeTimers();
  // Monday 2 November 2026, 10:00 in London.
  vi.setSystemTime(at('2026-11-02T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('readRepeatRule', () => {
  it('keeps each kind with what it uses, and drops what it does not', () => {
    expect(
      readRepeatRule({ every: 'day', from: '2026-11-02', timeZone: LONDON, days: [1] }),
    ).toEqual({ every: 'day', from: '2026-11-02', timeZone: LONDON });
    expect(readRepeatRule({ every: 'weekday', from: '2026-11-02', timeZone: 'UTC' })?.every).toBe(
      'weekday',
    );
    expect(
      readRepeatRule({ every: 'week', days: [4, 1], from: '2026-11-02', timeZone: LONDON }),
    ).toEqual({ every: 'week', days: [1, 4], from: '2026-11-02', timeZone: LONDON });
    expect(
      readRepeatRule({
        every: 'month',
        date: 31,
        until: '2027-01-31',
        status: ' To Do ',
        from: '2026-11-02',
        timeZone: LONDON,
        extra: true,
      }),
    ).toEqual({
      every: 'month',
      date: 31,
      until: '2027-01-31',
      status: 'To Do',
      from: '2026-11-02',
      timeZone: LONDON,
    });
  });

  it.each([
    ['not an object', 'daily'],
    ['an unknown every', { every: 'year', from: '2026-11-02', timeZone: LONDON }],
    ['no from', { every: 'day', timeZone: LONDON }],
    ['a from that is no day', { every: 'day', from: '2026-02-30', timeZone: LONDON }],
    ['an unknown zone', { every: 'day', from: '2026-11-02', timeZone: 'Nowhere/City' }],
    ['a week with no days', { every: 'week', days: [], from: '2026-11-02', timeZone: LONDON }],
    ['a week day past 6', { every: 'week', days: [7], from: '2026-11-02', timeZone: LONDON }],
    ['a week day twice', { every: 'week', days: [1, 1], from: '2026-11-02', timeZone: LONDON }],
    [
      'a week of days that is no list',
      { every: 'week', days: 1, from: '2026-11-02', timeZone: LONDON },
    ],
    ['a month with no date', { every: 'month', from: '2026-11-02', timeZone: LONDON }],
    ['a month date of 0', { every: 'month', date: 0, from: '2026-11-02', timeZone: LONDON }],
    ['a month date of 32', { every: 'month', date: 32, from: '2026-11-02', timeZone: LONDON }],
    ['a month date of 1.5', { every: 'month', date: 1.5, from: '2026-11-02', timeZone: LONDON }],
    [
      'an end before it starts',
      { every: 'day', until: '2026-11-01', from: '2026-11-02', timeZone: LONDON },
    ],
    [
      'an end that is no day',
      { every: 'day', until: 'soon', from: '2026-11-02', timeZone: LONDON },
    ],
    ['a column that is no text', { every: 'day', status: 3, from: '2026-11-02', timeZone: LONDON }],
    ['a blank column', { every: 'day', status: '  ', from: '2026-11-02', timeZone: LONDON }],
    [
      'a long column',
      { every: 'day', status: 'x'.repeat(41), from: '2026-11-02', timeZone: LONDON },
    ],
  ])('refuses %s', (_name, value) => {
    expect(readRepeatRule(value)).toBeUndefined();
  });

  it('is checked by validateFields like any field', () => {
    const ok = validateFields(
      { [REPEAT_FIELD]: { every: 'day', from: '2026-11-02', timeZone: LONDON } },
      'patch',
    );
    expect(ok).toEqual({
      ok: true,
      fields: { repeat: { every: 'day', from: '2026-11-02', timeZone: LONDON } },
    });
    expect(validateFields({ repeat: { every: 'often' } }, 'patch')).toEqual({
      ok: false,
      error: 'field_value_invalid',
      field: 'repeat',
    });
  });

  it('reads a card: whether it repeats, its rule, and whether a write changed it', () => {
    const r = rule({});
    const on = item({ title: 'Report', repeat: r as never });
    const off = item({ title: 'Report' });
    expect(itemRepeat(on)).toEqual(r);
    expect(itemRepeat(off)).toBeUndefined();
    expect(hasRepeat(on)).toBe(true);
    expect(hasRepeat(off)).toBe(false);
    expect(repeatChanged(off, on)).toBe(true);
    expect(repeatChanged(on, off)).toBe(true);
    expect(repeatChanged(on, item({ title: 'Renamed', repeat: r as never }))).toBe(false);
    expect(repeatChanged(undefined, off)).toBe(false);
    expect(repeatChanged(undefined, on)).toBe(true);
  });
});

describe('the days a rule falls on', () => {
  it('daily, weekdays and chosen week days', () => {
    expect(occursOn(rule({}), '2026-11-01')).toBe(true);
    const weekdays = rule({ every: 'weekday' });
    expect(occursOn(weekdays, '2026-11-02')).toBe(true);
    expect(occursOn(weekdays, '2026-11-06')).toBe(true);
    expect(occursOn(weekdays, '2026-11-07')).toBe(false);
    expect(occursOn(weekdays, '2026-11-01')).toBe(false);
    const monThu = rule({ every: 'week', days: [1, 4] });
    expect(occursOn(monThu, '2026-11-02')).toBe(true);
    expect(occursOn(monThu, '2026-11-05')).toBe(true);
    expect(occursOn(monThu, '2026-11-03')).toBe(false);
    expect(occursOn({ ...monThu, days: undefined }, '2026-11-02')).toBe(false);
  });

  it('the 31st is the last day of a shorter month, and February is 28 or 29', () => {
    const r = rule({ every: 'month', date: 31 });
    expect(occursOn(r, '2026-04-30')).toBe(true);
    expect(occursOn(r, '2026-04-29')).toBe(false);
    expect(occursOn(r, '2026-05-31')).toBe(true);
    expect(occursOn(r, '2026-05-30')).toBe(false);
    expect(occursOn(r, '2026-02-28')).toBe(true);
    expect(occursOn(r, '2028-02-29')).toBe(true);
    expect(occursOn(r, '2028-02-28')).toBe(false);
    expect(nextOccurrence(r, '2026-03-31')).toBe('2026-04-30');
    expect(nextOccurrence(r, '2026-04-30')).toBe('2026-05-31');
    expect(occursOn({ ...r, date: undefined }, '2026-11-01')).toBe(true);
  });

  it('finds the next day, the latest in a range and the one before, held to its end', () => {
    const monThu = rule({ every: 'week', days: [1, 4], until: '2026-11-12' });
    expect(nextOccurrence(monThu, '2026-11-02')).toBe('2026-11-05');
    expect(nextOccurrence(monThu, '2026-11-05')).toBe('2026-11-09');
    expect(nextOccurrence(monThu, '2026-11-12')).toBeNull();
    expect(latestOccurrence(monThu, '2026-11-02', '2026-11-11')).toBe('2026-11-09');
    expect(latestOccurrence(monThu, '2026-11-02', '2026-11-30')).toBe('2026-11-12');
    expect(latestOccurrence(monThu, '2026-11-05', '2026-11-08')).toBeNull();
    expect(latestOccurrence(monThu, '2026-11-09', '2026-11-09')).toBeNull();
    expect(previousOccurrence(monThu, '2026-11-04')).toBe('2026-11-02');
    expect(previousOccurrence(monThu, '2026-11-05')).toBe('2026-11-05');
  });

  it('gives up past its search when a rule never falls (a hand-made week of no days)', () => {
    const never = { ...rule({ every: 'week' }), days: [] };
    expect(nextOccurrence(never, '2026-11-02')).toBeNull();
    expect(previousOccurrence(never, '2026-11-02')).toBeNull();
    expect(latestOccurrence(never, '2020-01-01', '2026-11-02')).toBeNull();
  });
});

describe('repeatSchedule', () => {
  it('makes nothing on the day it was set, and wakes at the next local midnight', () => {
    const r = rule({});
    const s = repeatSchedule(r, settledFloor(r, null, Date.now()), Date.now());
    expect(s.make).toBeNull();
    expect(s.next).toBe('2026-11-03');
    expect(new Date(s.nextAt!).toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('makes the day that has come at its midnight', () => {
    vi.setSystemTime(at('2026-11-03T00:00:00Z'));
    const s = repeatSchedule(rule({}), '2026-11-02', Date.now());
    expect(s).toMatchObject({ make: '2026-11-03', next: '2026-11-04' });
  });

  it('wakes late: one copy, for the latest missed day, never a burst', () => {
    vi.setSystemTime(at('2026-11-20T09:00:00Z'));
    const weekly = rule({ every: 'week', days: [1] });
    const s = repeatSchedule(weekly, '2026-11-02', Date.now());
    expect(s.make).toBe('2026-11-16');
    expect(s.next).toBe('2026-11-23');
  });

  it('an early wake makes nothing and keeps the same next day', () => {
    vi.setSystemTime(at('2026-11-02T23:59:00Z'));
    const s = repeatSchedule(rule({}), '2026-11-02', Date.now());
    expect(s).toMatchObject({ make: null, next: '2026-11-03' });
  });

  it('ends with its last day', () => {
    vi.setSystemTime(at('2026-11-04T08:00:00Z'));
    const s = repeatSchedule(rule({ until: '2026-11-04' }), '2026-11-03', Date.now());
    expect(s).toEqual({ make: '2026-11-04', next: null, nextAt: null });
  });

  it("is the setter's day: the same instant is Monday in Auckland and still Sunday in Los Angeles", () => {
    vi.setSystemTime(at('2026-11-02T06:00:00Z'));
    const monday: Partial<RepeatRule> = { every: 'week', days: [1], from: '2026-10-26' };
    const auckland = repeatSchedule(
      rule({ ...monday, timeZone: 'Pacific/Auckland' }),
      '2026-10-26',
      Date.now(),
    );
    const angeles = repeatSchedule(
      rule({ ...monday, timeZone: 'America/Los_Angeles' }),
      '2026-10-26',
      Date.now(),
    );
    expect(auckland.make).toBe('2026-11-02');
    expect(angeles.make).toBeNull();
    expect(new Date(angeles.nextAt!).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });

  it('wakes at the right instant across a clock change', () => {
    vi.setSystemTime(at('2026-03-28T12:00:00Z'));
    const s = repeatSchedule(rule({ from: '2026-03-28' }), '2026-03-28', Date.now());
    expect(new Date(s.nextAt!).toISOString()).toBe('2026-03-29T00:00:00.000Z');
    vi.setSystemTime(at('2026-03-29T12:00:00Z'));
    const after = repeatSchedule(rule({ from: '2026-03-28' }), '2026-03-29', Date.now());
    expect(new Date(after.nextAt!).toISOString()).toBe('2026-03-29T23:00:00.000Z');
  });

  it('settles from the saved day, yesterday or a later day already settled', () => {
    const r = rule({ from: '2026-10-01' });
    expect(settledFloor(r, null, Date.now())).toBe('2026-11-01');
    expect(settledFloor(r, '2026-11-02', Date.now())).toBe('2026-11-02');
    expect(settledFloor(rule({ from: '2026-11-02' }), '2026-10-20', Date.now())).toBe('2026-11-02');
  });

  it('names the next day for the panel', () => {
    expect(repeatNext(rule({ every: 'weekday' }), Date.now())).toBe('2026-11-03');
    expect(repeatNext(rule({ from: '2026-11-10' }), Date.now())).toBe('2026-11-11');
  });
});

describe('repeat words', () => {
  it('says each kind, Monday first, with its end', () => {
    expect(repeatRuleWords(rule({}))).toBe('every day');
    expect(repeatRuleWords(rule({ every: 'weekday' }))).toBe('every weekday');
    expect(repeatRuleWords(rule({ every: 'week', days: [0, 4, 1] }))).toBe(
      'every week on Mon, Thu and Sun',
    );
    expect(repeatRuleWords(rule({ every: 'week', days: [5] }))).toBe('every week on Fri');
    expect(repeatRuleWords({ ...rule({ every: 'week' }), days: undefined })).toBe('every week on ');
    expect(repeatRuleWords(rule({ every: 'month', date: 31, until: '2026-12-31' }))).toBe(
      'every month on the 31st, until Thu 31 Dec 2026',
    );
    expect(repeatRuleWords({ ...rule({ every: 'month' }), date: undefined })).toBe(
      'every month on the 1st',
    );
  });

  it('ordinals, lists and days', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '30th',
      '111th',
    ]);
    expect(listWords([])).toBe('');
    expect(listWords(['Mon', 'Thu'])).toBe('Mon and Thu');
    expect(dayWords('2026-11-05', 2026)).toBe('Thu 5 Nov');
    expect(dayWords('2027-01-01', 2026)).toBe('Fri 1 Jan 2027');
  });
});

describe('agents', () => {
  it('change_items refuses a repeat with where to set one, and a custom field named Repeat is still that field', () => {
    const task = ITEM_TYPES[1]!;
    expect(resolveFields({ Repeat: 'weekly' }, task, { statuses: [], items: [] })).toEqual({
      ok: false,
      code: 'value_invalid',
      message: REPEAT_REFUSAL,
    });
    const withField = {
      ...task,
      custom: [{ id: 'f-repeat', label: 'Repeat', kind: 'text' as const }],
    };
    expect(resolveFields({ Repeat: 'weekly' }, withField, { statuses: [], items: [] })).toEqual({
      ok: true,
      fields: { 'f-repeat': 'weekly' },
    });
  });
});
