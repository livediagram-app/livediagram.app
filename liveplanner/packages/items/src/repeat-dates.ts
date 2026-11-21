// The days a repeating card's rule speaks in (docs/specs/026-plan/items.md "Repeating cards", blueprint item-store.md
// "Repeats"): `YYYY-MM-DD` days, worked on as UTC day numbers so a day's weekday never depends on a time zone, and the
// time zone sums that say which day it is somewhere and when that day starts there.

import { dayKey, dayNumber, dayParts } from './plan-view-dates';

// The time zone sums (which day it is somewhere, when a day starts there, when a clock there reads a time) and a
// rule's time zone check are @liveworkspace/automations', whose time triggers share them
// (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The schedule").
export {
  ZONE_CACHE_MAX as REPEAT_ZONE_CACHE_MAX,
  clockMoment,
  dayStart,
  isRuleTimeZone,
  localDay,
} from '@liveworkspace/automations';

// A day that exists, as `YYYY-MM-DD` (the plan views' day numbers, plan-view-dates.ts).
export const isDay = (v: unknown): v is string => dayNumber(v) !== undefined;

// A checked day's number.
export const dayNo = (day: string): number => dayNumber(day) ?? 0;

export const addDays = (day: string, n: number): string => dayKey(dayNo(day) + n);

// 0 Sunday to 6 Saturday, as a rule's `days` count them.
export const weekdayOf = (day: string): number => (dayParts(dayNo(day)).weekday + 1) % 7;

export const laterDay = (a: string, b: string): string => (a > b ? a : b);
