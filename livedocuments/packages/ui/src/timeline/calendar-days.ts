// Calendar days for the timeline's month grid (monthCells.ts): a day as a whole day number since 1970-01-01, so the
// grid is integer arithmetic with no time zone in it.
const DAY_MS = 86_400_000;

// Monday first, matching `dayParts`'s weekday.
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function dayParts(day: number): {
  year: number;
  month: number;
  date: number;
  weekday: number;
} {
  const d = new Date(day * DAY_MS);
  // 0 is Monday.
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    weekday: (d.getUTCDay() + 6) % 7,
  };
}

export function monthStart(year: number, month: number): number {
  return Math.round(Date.UTC(year, month, 1) / DAY_MS);
}

// The month `offset` months from `year`/`month` (0-based), normalised.
export function shiftMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const n = year * 12 + month + offset;
  return { year: Math.floor(n / 12), month: ((n % 12) + 12) % 12 };
}

// The number of days in `year`/`month` (0-based).
export function daysInMonth(year: number, month: number): number {
  const next = shiftMonth(year, month, 1);
  return monthStart(next.year, next.month) - monthStart(year, month);
}
