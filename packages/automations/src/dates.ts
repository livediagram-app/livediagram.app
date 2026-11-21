// The days and moments a rule's schedule speaks in (liveworkspace/docs/specs/018-automations/automations.md "Triggers
// every app has": Scheduled). `YYYY-MM-DD` days, worked on as UTC day numbers so a day's weekday never depends on a
// time zone, and the time zone sums that say which day it is somewhere and when a clock there reads a time. Pure.

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
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

const monthStart = (year: number, month: number): number =>
  Math.round(Date.UTC(year, month, 1) / DAY_MS);

// The number of days in `year`/`month` (0-based).
export const daysInMonth = (year: number, month: number): number =>
  monthStart(year + Math.floor((month + 1) / 12), (month + 1) % 12) - monthStart(year, month);

// Days since 1970-01-01 for a `YYYY-MM-DD` value that is a real date; undefined for anything else. A day past its
// month's end ("2026-02-31") is not a date, rather than a day in the next month.
export function dayNumber(value: unknown): number | undefined {
  const m = typeof value === 'string' ? ISO_DAY.exec(value) : null;
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo - 1)) return undefined;
  return Math.round(Date.UTC(y, mo - 1, d) / DAY_MS);
}

const utcParts = (day: number) => {
  const d = new Date(day * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate() };
};

// A day number back to `YYYY-MM-DD`.
export function dayKey(day: number): string {
  const p = utcParts(day);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.date).padStart(2, '0')}`;
}

// A day that exists, as `YYYY-MM-DD`.
export const isDay = (v: unknown): v is string => dayNumber(v) !== undefined;

// A checked day's number.
export const dayNo = (day: string): number => dayNumber(day) ?? 0;

export const addDays = (day: string, n: number): string => dayKey(dayNo(day) + n);

// 0 Sunday to 6 Saturday, as a schedule's `days` count them.
export const weekdayOf = (day: string): number => new Date(dayNo(day) * DAY_MS).getUTCDay();

// "11 Nov 2026" for a day number.
export function dayWords(day: number): string {
  const p = utcParts(day);
  return `${p.date} ${MONTH_SHORT[p.month]} ${p.year}`;
}

// "11 Nov 2026" for `2026-11-11`; anything else as it is.
export function dayText(day: string): string {
  const n = dayNumber(day);
  return n === undefined ? day : dayWords(n);
}

// How many time zones' formatters are kept: an item's rules name a handful.
export const ZONE_CACHE_MAX = 32;

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
  if (zones.size >= ZONE_CACHE_MAX) zones.delete(zones.keys().next().value as string);
  zones.set(timeZone, made);
  return made;
}

// A rule's time zone: a short string naming an IANA zone this runtime knows ("Europe/London", "UTC"). Bounded
// first, so a stored rule can never be a long string.
export function isRuleTimeZone(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 64) return false;
  try {
    formatter(v);
    return true;
  } catch {
    return false;
  }
}

export type ZonedClock = { y: number; m: number; d: number; h: number; min: number; s: number };

// The wall clock `timeZone` reads at `ms` (`m` 1-based).
export function zonedClock(ms: number, timeZone: string): ZonedClock {
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
  const c = zonedClock(ms, timeZone);
  return `${String(c.y).padStart(4, '0')}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}

// How far `timeZone`'s clock is ahead of UTC at `ms`.
function offsetAt(ms: number, timeZone: string): number {
  const c = zonedClock(ms, timeZone);
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

// The instant `timeZone`'s clock reads `minutes` past midnight on `day` (a time trigger's moment). A time a clock
// change repeats is its first; a time a change skips is the first minute after the change. The offsets a day either
// side tell the two candidates; a candidate whose own offset agrees reads the time.
export function clockMoment(day: string, minutes: number, timeZone: string): number {
  const wall = dayNo(day) * DAY_MS + minutes * MINUTE_MS;
  const before = offsetAt(wall - DAY_MS, timeZone);
  const after = offsetAt(wall + DAY_MS, timeZone);
  const reads = [wall - before, wall - after].filter((t) => offsetAt(t, timeZone) === wall - t);
  if (reads.length) return Math.min(...reads);
  // Skipped: the change lies between the two candidates; the first minute on its far side, found by halving.
  let lo = Math.floor((wall - Math.max(before, after)) / MINUTE_MS);
  let hi = Math.ceil((wall - Math.min(before, after)) / MINUTE_MS);
  const far = offsetAt(hi * MINUTE_MS, timeZone);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (offsetAt(mid * MINUTE_MS, timeZone) === far) hi = mid;
    else lo = mid;
  }
  return hi * MINUTE_MS;
}

// What a repeating schedule says: every day, every weekday, chosen weekdays (0 Sunday to 6), or a day of the month.
export type Recurrence = {
  every: 'day' | 'weekday' | 'week' | 'month';
  days?: readonly number[];
  date?: number;
};

// Whether the recurrence falls on `day`: a month's day past its end falls on its last.
export function occursOn(rule: Recurrence, day: string): boolean {
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

// How far a schedule's next day is looked for: a year and a month, inside which every recurrence meets a day.
export const RECURRENCE_SEARCH_DAYS = 400;
