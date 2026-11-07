// The Calendar Wall's month (docs/specs/009-elements/team-pieces.md "Calendar Wall"): six weeks of days, Monday first,
// so any month fits the same ruled grid on every screen, each day named `YYYY-MM-DD` as a note's day is. Pure.

export type CalendarCell = {
  /** The day as a note names it. */
  day: string;
  /** Its number in its month. */
  date: number;
  /** Whether it is in the month shown, or spills over from the one before or after. */
  inMonth: boolean;
  isToday: boolean;
};

export type MonthCursor = { year: number; month: number };

/** Weeks shown, always: enough for a 31-day month starting on a Sunday. */
export const CALENDAR_WEEKS = 6;
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const pad2 = (v: number) => String(v).padStart(2, '0');

/** The month a day is in. */
export function cursorOf(day: string): MonthCursor {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
}

/** A month `by` months on (or back). */
export function stepMonth(cursor: MonthCursor, by: number): MonthCursor {
  const m = cursor.year * 12 + cursor.month + by;
  return { year: Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

/** The six weeks shown for a month, Monday first; `today` is the viewer's own `YYYY-MM-DD`. */
export function calendarMonth({ year, month }: MonthCursor, today: string): CalendarCell[] {
  // Monday is 0: Date's Sunday (0) comes last.
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < CALENDAR_WEEKS * 7; i += 1) {
    const d = new Date(Date.UTC(year, month, 1 - lead + i));
    const day = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    cells.push({
      day,
      date: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
      isToday: day === today,
    });
  }
  return cells;
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

const utcOf = (day: string) =>
  Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

/** "November 2026". */
export function monthTitle({ year, month }: MonthCursor): string {
  return MONTH.format(Date.UTC(year, month, 1));
}

/** "5 Nov", for a button and a note's day. */
export function shortDay(day: string): string {
  return SHORT.format(utcOf(day));
}

/** "5 November", for a screen reader. */
export function longDay(day: string): string {
  return LONG.format(utcOf(day));
}
