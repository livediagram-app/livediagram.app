// Moving a card on a calendar view (docs/specs/026-plan/plan-views.md "Moving a card on a calendar"): a Due
// Calendar moves its Due, a Start Calendar its Start, to the day it is dropped on. The other date stays put
// unless the move would cross it: then it shifts by the same number of days, so Start never falls after Due.
// Pure: whole day numbers, no time zone.
import type { Item } from './item';
import type { PlanViewId } from './plan-views';
import { dayKey, dayNumber } from './plan-view-dates';
import { BUILT_IN_DATES, type ViewDates } from './view-fields';

// The date role a calendar places its cards by; its field is the view's pick for that role (view-fields.ts).
export type CalendarField = 'due' | 'start';

// The calendar views and the field each places by.
const CALENDAR_FIELDS: Readonly<Partial<Record<PlanViewId, CalendarField>>> = {
  calendar: 'due',
  'start-calendar': 'start',
};

export function calendarFieldOf(view: PlanViewId): CalendarField | undefined {
  return CALENDAR_FIELDS[view];
}

// The fields a move sets, or null when there is nothing to move (no date on the card, or the same day).
export function calendarMove(
  item: Pick<Item, 'fields'>,
  field: CalendarField,
  toDay: number,
  // The fields the calendar reads for each role (docs/specs/026-plan/plan-views.md "Dates").
  dates: ViewDates = BUILT_IN_DATES,
): { set: Record<string, string>; days: number } | null {
  const from = dayNumber(item.fields[dates[field]]);
  if (from === undefined || !Number.isInteger(toDay) || toDay === from) return null;
  const days = toDay - from;
  const set: Record<string, string> = { [dates[field]]: dayKey(toDay) };
  const other: CalendarField = field === 'due' ? 'start' : 'due';
  const otherDay = dayNumber(item.fields[dates[other]]);
  if (otherDay !== undefined) {
    // A Due moved before its Start takes the Start with it (and a Start moved past its Due the Due), by the same
    // days; never past the moved date, even when the card's dates were the wrong way round to begin with.
    if (field === 'due' && otherDay > toDay)
      set[dates[other]] = dayKey(Math.min(otherDay + days, toDay));
    if (field === 'start' && otherDay < toDay)
      set[dates[other]] = dayKey(Math.max(otherDay + days, toDay));
  }
  return { set, days };
}
