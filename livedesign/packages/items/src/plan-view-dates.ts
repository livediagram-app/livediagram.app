// Calendar days for the plan views (docs/specs/026-plan/plan-views.md): a `YYYY-MM-DD` date field as a
// whole day number, so a time axis or a month grid is integer arithmetic with no time zone in it. The
// timeline's month grid (packages/ui/src/timeline/monthCells.ts) shares the same arithmetic.
export const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
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

// Days since 1970-01-01 for a `YYYY-MM-DD` value, or undefined for anything else.
export function dayNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const m = ISO_DAY.exec(value);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return Math.round(Date.UTC(y, mo - 1, d) / DAY_MS);
}

// The viewer's today, as a day number (their own calendar day, not UTC's).
export function todayNumber(now: Date): number {
  return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

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

// A day number back to `YYYY-MM-DD`.
export function dayKey(day: number): string {
  const p = dayParts(day);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.date).padStart(2, '0')}`;
}
