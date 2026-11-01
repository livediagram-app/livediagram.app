// A repeating card's rule (docs/specs/026-plan/items.md "Repeating cards", blueprint item-store.md "Repeats"): what
// it says, the checks every door runs on it, which days it falls on, and when its next copy is due. Pure: the api's
// alarm, the editor's panel and list_items all read it from here. Assigned actions do not recur, so this is the
// planner's one recurrence.
import type { Item } from './item';
import { ITEM_STATUS_MAX } from './limits';
import { dayKey, daysInMonth } from './plan-view-dates';
import {
  addDays,
  dayNo,
  dayStart,
  isDay,
  isTimeZone,
  laterDay,
  localDay,
  weekdayOf,
} from './repeat-dates';
import { isObj } from './validate';

export const REPEAT_FIELD = 'repeat';
export const REPEAT_EVERY = ['day', 'weekday', 'week', 'month'] as const;
export type RepeatEvery = (typeof REPEAT_EVERY)[number];

// How far a rule's next or last day is looked for: a year and a month, inside which every rule meets a day.
export const REPEAT_SEARCH_DAYS = 400;

export interface RepeatRule {
  every: RepeatEvery;
  // `week` only: 0 (Sunday) to 6, ascending and unique.
  days?: number[];
  // `month` only: 1 to 31; past a month's end, its last day.
  date?: number;
  // The last day a copy may be made for, on or after `from`.
  until?: string;
  // The column a copy lands in; absent: its type's starting state.
  status?: string;
  // The setter's day the rule was saved: the card itself stands for it, so copies start after it.
  from: string;
  // The setter's IANA time zone: every day of the rule is a day there.
  timeZone: string;
}

const isEvery = (v: unknown): v is RepeatEvery =>
  typeof v === 'string' && (REPEAT_EVERY as readonly string[]).includes(v);

function readDays(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || v.length === 0 || v.length > 7) return undefined;
  if (!v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return undefined;
  const days = [...new Set(v as number[])].sort((a, b) => a - b);
  return days.length === v.length ? days : undefined;
}

// The rule as every door keeps it, or undefined when it is not one (refused `field_value_invalid`). Keys a kind does
// not use are dropped.
export function readRepeatRule(v: unknown): RepeatRule | undefined {
  if (!isObj(v)) return undefined;
  const { every, from, timeZone, until, status } = v;
  if (!isEvery(every) || !isDay(from) || !isTimeZone(timeZone)) return undefined;
  const rule: RepeatRule = { every, from, timeZone };
  if (every === 'week') {
    const days = readDays(v['days']);
    if (!days) return undefined;
    rule.days = days;
  }
  if (every === 'month') {
    const date = v['date'];
    if (!Number.isInteger(date) || (date as number) < 1 || (date as number) > 31) return undefined;
    rule.date = date as number;
  }
  if (until !== undefined) {
    if (!isDay(until) || until < from) return undefined;
    rule.until = until;
  }
  if (status !== undefined) {
    if (typeof status !== 'string') return undefined;
    const s = status.trim();
    if (s.length === 0 || s.length > ITEM_STATUS_MAX) return undefined;
    rule.status = s;
  }
  return rule;
}

// The card's rule, or undefined when it does not repeat.
export const itemRepeat = (item: Pick<Item, 'fields'>): RepeatRule | undefined =>
  readRepeatRule(item.fields[REPEAT_FIELD]);

// Whether a card carries a rule at all: a key test, cheap enough for every card face on a board.
export const hasRepeat = (item: Pick<Item, 'fields'>): boolean => isObj(item.fields[REPEAT_FIELD]);

// Whether a write sets, changes or clears the rule (an Editor's alone). The stored rule is normalised, so its text
// compares.
export function repeatChanged(
  before: Pick<Item, 'fields'> | undefined,
  after: Pick<Item, 'fields'>,
): boolean {
  return (
    JSON.stringify(before?.fields[REPEAT_FIELD] ?? null) !==
    JSON.stringify(after.fields[REPEAT_FIELD] ?? null)
  );
}

// Whether the rule falls on `day` (its end aside).
export function occursOn(rule: RepeatRule, day: string): boolean {
  const weekday = weekdayOf(day);
  switch (rule.every) {
    case 'day':
      return true;
    case 'weekday':
      return weekday >= 1 && weekday <= 5;
    case 'week':
      return (rule.days ?? []).includes(weekday);
    case 'month': {
      const [y, m, d] = day.split('-').map(Number) as [number, number, number];
      return d === Math.min(rule.date ?? 1, daysInMonth(y, m - 1));
    }
  }
}

// The first due day strictly after `after`, or null: past the rule's end, or none within REPEAT_SEARCH_DAYS.
export function nextOccurrence(rule: RepeatRule, after: string): string | null {
  const start = dayNo(after);
  for (let i = 1; i <= REPEAT_SEARCH_DAYS; i += 1) {
    const day = dayKey(start + i);
    if (rule.until !== undefined && day > rule.until) return null;
    if (occursOn(rule, day)) return day;
  }
  return null;
}

// The last due day in (`after`, `through`], its end held, or null when there is none.
export function latestOccurrence(rule: RepeatRule, after: string, through: string): string | null {
  const last = rule.until !== undefined && rule.until < through ? rule.until : through;
  const floor = dayNo(after);
  const top = dayNo(last);
  for (let n = top; n > floor && top - n < REPEAT_SEARCH_DAYS; n -= 1) {
    const day = dayKey(n);
    if (occursOn(rule, day)) return day;
  }
  return null;
}

// The last due day on or before `day`, its end aside: the day a card stands for under its rule.
export function previousOccurrence(rule: RepeatRule, day: string): string | null {
  const top = dayNo(day);
  for (let i = 0; i < REPEAT_SEARCH_DAYS; i += 1) {
    const d = dayKey(top - i);
    if (occursOn(rule, d)) return d;
  }
  return null;
}

// The day settled before a first look, an edit or a restore: the day it was saved, or yesterday, or a later day
// already settled. Days missed before it never come (late, never a burst); today's still can.
export function settledFloor(rule: RepeatRule, settled: string | null, now: number): string {
  const yesterday = addDays(localDay(now, rule.timeZone), -1);
  return laterDay(laterDay(settled ?? '', rule.from), yesterday);
}

export type RepeatSchedule = {
  // The day to make a copy for now (the latest one due, however many were missed), or null.
  make: string | null;
  // The next due day after it and today, or null when the rule has ended.
  next: string | null;
  // When that day starts in the rule's time zone.
  nextAt: number | null;
};

// What the alarm does for a rule whose last settled day is `settled`, at `now`.
export function repeatSchedule(rule: RepeatRule, settled: string, now: number): RepeatSchedule {
  const today = localDay(now, rule.timeZone);
  const make = latestOccurrence(rule, settled, today);
  const next = nextOccurrence(rule, laterDay(laterDay(settled, make ?? ''), today));
  return { make, next, nextAt: next === null ? null : dayStart(next, rule.timeZone) };
}

// The next day a copy comes, as the panel says it: after today and the day the rule was saved.
export function repeatNext(rule: RepeatRule, now: number): string | null {
  return nextOccurrence(rule, laterDay(rule.from, localDay(now, rule.timeZone)));
}
