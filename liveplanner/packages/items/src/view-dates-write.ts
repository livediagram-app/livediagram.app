// Reading and writing a view's dates by role (docs/specs/026-plan/plan-views.md "Dates", "Times and ranges"): a
// Gantt chart, the calendars and their moves read a role's date whatever its field holds (a day, a moment, a range's
// end) and write whole days back in that field's own shape, keeping a moment's time of day. Pure.
import type { Item, ItemFieldValue } from './item';
import { dayKey, dayNumber } from './plan-view-dates';
import { instantOnDay, readInstant } from './date-time-fields';
import { rangeEndOf, rangeWithEnd, type DateRole } from './date-range-fields';
import type { ViewDates } from './view-fields';

const shapeOf = (dates: ViewDates, role: DateRole) => dates.shapes?.[role] ?? 'date';

// A role's date on a card: its field's value, or a range's end for the role.
export function roleValue(
  item: Pick<Item, 'fields'>,
  dates: ViewDates,
  role: DateRole,
): ItemFieldValue | undefined {
  const v = item.fields[dates[role]];
  const shape = shapeOf(dates, role);
  return shape === 'daterange' || shape === 'daterange-time' ? rangeEndOf(v, role) : v;
}

// The day a role's date falls on in `tz` (the viewer's zone without one).
export function roleDay(
  item: Pick<Item, 'fields'>,
  dates: ViewDates,
  role: DateRole,
  tz?: string,
): number | undefined {
  return dayNumber(roleValue(item, dates, role), tz);
}

// A role's moment when its date has a time of day (a Date and Time, or a timed range's end): the ms, else undefined.
export function roleMoment(
  item: Pick<Item, 'fields'>,
  dates: ViewDates,
  role: DateRole,
): number | undefined {
  return readInstant(roleValue(item, dates, role))?.ms;
}

// The fields that put each changed role on its new day: a day as `YYYY-MM-DD`, a moment on that day at its own time
// (or TIMED_DEFAULT_HOUR when it had none), a range with that end set (both roles of one range in one value).
export function roleDays(
  item: Pick<Item, 'fields'>,
  dates: ViewDates,
  changes: Partial<Record<DateRole, number>>,
  tz?: string,
): Record<string, ItemFieldValue> {
  const set: Record<string, ItemFieldValue> = {};
  for (const role of ['start', 'due'] as const) {
    const day = changes[role];
    if (day === undefined) continue;
    const id = dates[role];
    const shape = shapeOf(dates, role);
    const current = id in set ? set[id] : item.fields[id];
    if (shape === 'datetime') set[id] = instantOnDay(current, day, tz);
    else if (shape === 'daterange') set[id] = rangeWithEnd(current, role, dayKey(day));
    else if (shape === 'daterange-time')
      set[id] = rangeWithEnd(current, role, instantOnDay(rangeEndOf(current, role), day, tz));
    else set[id] = dayKey(day);
  }
  return set;
}
