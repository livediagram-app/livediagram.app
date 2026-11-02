// The days a repeating card's rule speaks in (docs/specs/026-plan/items.md "Repeating cards", blueprint item-store.md
// "Repeats"): `YYYY-MM-DD` days, worked on as UTC day numbers so a day's weekday never depends on a time zone, and the
// time zone sums that say which day it is somewhere and when that day starts there.

import { isTimeZone } from './date-time-fields';
import { DAY_MS, dayKey, dayNumber, dayParts } from './plan-view-dates';

const HOUR_MS = 3_600_000;

// How many time zones' formatters are kept: a plan's rules name a handful.
export const REPEAT_ZONE_CACHE_MAX = 32;

// A day that exists, as `YYYY-MM-DD` (the plan views' day numbers, plan-view-dates.ts).
export const isDay = (v: unknown): v is string => dayNumber(v) !== undefined;

// A checked day's number.
export const dayNo = (day: string): number => dayNumber(day) ?? 0;

export const addDays = (day: string, n: number): string => dayKey(dayNo(day) + n);

// 0 Sunday to 6 Saturday, as a rule's `days` count them.
export const weekdayOf = (day: string): number => (dayParts(dayNo(day)).weekday + 1) % 7;

export const laterDay = (a: string, b: string): string => (a > b ? a : b);

const zones = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const kept = zones.get(timeZone);
  if (kept) return kept;
  // Throws a RangeError for a zone Intl does not know, before anything is kept.
  const made = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  if (zones.size >= REPEAT_ZONE_CACHE_MAX) zones.delete(zones.keys().next().value as string);
  zones.set(timeZone, made);
  return made;
}

// A rule's time zone: a short string naming an IANA zone this runtime knows ("Europe/London", "UTC"), checked by
// the Date & Time fields' isTimeZone. Bounded first, so a stored rule can never be a long string.
export const isRuleTimeZone = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 64 && isTimeZone(v);

type Clock = { y: number; m: number; d: number; h: number; min: number; s: number };

function clockAt(ms: number, timeZone: string): Clock {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(ms)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    y: out['year']!,
    m: out['month']!,
    d: out['day']!,
    // An engine that still says 24 for midnight means 0.
    h: out['hour']! % 24,
    min: out['minute']!,
    s: out['second']!,
  };
}

// The day it is at `ms` in `timeZone`.
export function localDay(ms: number, timeZone: string): string {
  const c = clockAt(ms, timeZone);
  return `${String(c.y).padStart(4, '0')}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}

// How far `timeZone`'s clock is ahead of UTC at `ms`.
function offsetAt(ms: number, timeZone: string): number {
  const c = clockAt(ms, timeZone);
  return Date.UTC(c.y, c.m - 1, c.d, c.h, c.min, c.s) - Math.floor(ms / 1000) * 1000;
}

// The first instant of `day` in `timeZone`: its midnight, or, where a clock change skips midnight, the moment the day
// starts. The offset is worked out twice, since the offset at the first guess can be the other side of a change.
export function dayStart(day: string, timeZone: string): number {
  const base = dayNo(day) * DAY_MS;
  let t = base - offsetAt(base, timeZone);
  t = base - offsetAt(t, timeZone);
  for (let i = 0; i < 3 && localDay(t, timeZone) < day; i += 1) t += HOUR_MS;
  return t;
}
