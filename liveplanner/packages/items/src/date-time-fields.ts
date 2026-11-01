// Date and Time fields (docs/specs/026-plan/item-types.md "Date and Time"): a moment, stored as its UTC instant
// followed by the time zone it was set in (RFC 9557, `2026-10-31T17:00:00Z[Europe/London]`), and read in each
// viewer's own zone. One reading shared by the card panel, the card face, the calendars, the Gantt chart, CSV, forms
// and agents. Pure: a zone is named (`tz`), or left out to mean the runtime's own (the viewer's, in a browser).

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

// The hour a date written where there was none takes on a Date and Time field (docs/specs/026-plan/plan-views.md
// "Times and ranges"): 9:00 in the viewer's zone, the start of a working day.
export const TIMED_DEFAULT_HOUR = 9;

// Years a moment may have: four digits, as a date box takes (docs/specs/004-interface-design/date-fields.md).
const YEAR_MIN = 1000;
const YEAR_MAX = 9999;

// An ISO 8601 date and time: a `T` or a space between them, optional seconds and fraction, then `Z` or an offset
// (optional only when read as local), then an optional zone in brackets. Each part has one place to match, so no
// input backtracks.
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d{1,9})?)?(Z|[+-]\d{2}(?::?\d{2})?)?(?:\[([A-Za-z0-9_+/-]{1,64})\])?$/i;

export interface Instant {
  // Milliseconds since 1970, floored to the minute.
  ms: number;
  // The IANA zone it was set in, when known.
  zone?: string;
}

const zoneChecks = new Map<string, boolean>();

// Whether `zone` is a time zone this runtime knows (checked once a zone).
export function isTimeZone(zone: string): boolean {
  let ok = zoneChecks.get(zone);
  if (ok === undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
      ok = true;
    } catch {
      ok = false;
    }
    zoneChecks.set(zone, ok);
  }
  return ok;
}

// The viewer's own zone (the runtime's), "UTC" when it can't say.
export function viewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const dayOf = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / DAY_MS);

function realDay(y: number, m: number, d: number): boolean {
  const at = new Date(Date.UTC(y, m, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m && at.getUTCDate() === d;
}

interface ZonedParts {
  year: number;
  // 0-based.
  month: number;
  date: number;
  hour: number;
  minute: number;
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();

// A moment's wall-clock parts in `tz`, or in the runtime's zone without one (through the Date getters, the fast path a
// board's render takes).
export function zonedParts(ms: number, tz?: string): ZonedParts {
  if (!tz) {
    const d = new Date(ms);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      date: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }
  let f = partFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    partFormatters.set(tz, f);
  }
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(ms)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return {
    year: out['year']!,
    month: out['month']! - 1,
    date: out['day']!,
    hour: out['hour']! % 24,
    minute: out['minute']!,
  };
}

// The day a moment falls on in `tz`, as a day number (days since 1970-01-01, plan-view-dates.ts).
export function zonedDay(ms: number, tz?: string): number {
  const p = zonedParts(ms, tz);
  return dayOf(p.year, p.month, p.date);
}

// How far `tz` is ahead of UTC at `ms`, in ms.
function offsetAt(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return (
    Date.UTC(p.year, p.month, p.date, p.hour, p.minute) - Math.floor(ms / MINUTE_MS) * MINUTE_MS
  );
}

// The moment a wall-clock time on `day` is in `tz` (the runtime's zone without one). A time a clock change skips moves
// forward by the change; a time it repeats takes the first, as the platform's own local dates do.
export function zonedInstant(day: number, hour: number, minute: number, tz?: string): number {
  const d = new Date(day * DAY_MS);
  const [y, m, dd] = [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
  if (!tz) return new Date(y, m, dd, hour, minute).getTime();
  const local = Date.UTC(y, m, dd, hour, minute);
  const before = offsetAt(local - DAY_MS / 2, tz);
  const after = offsetAt(local + DAY_MS / 2, tz);
  const fits = [local - before, local - after]
    .filter((t) => offsetAt(t, tz) === local - t)
    .sort((a, b) => a - b);
  return fits[0] ?? local - before;
}

// The stored form: the instant to the minute, then its zone in brackets when known.
export function instantValue(ms: number, zone?: string): string {
  const at = new Date(Math.floor(ms / MINUTE_MS) * MINUTE_MS).toISOString();
  return `${at.slice(0, 19)}Z${zone ? `[${zone}]` : ''}`;
}

function offsetMinutes(text: string): number {
  if (text.toUpperCase() === 'Z') return 0;
  const sign = text.startsWith('-') ? -1 : 1;
  const digits = text.slice(1).replace(':', '');
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || '0'));
}

// A moment from ISO 8601 text: with `local`, a time with no offset is read in the runtime's zone (and stamped with
// it); without, an offset is required. A bracketed zone the runtime doesn't know is dropped, never refused.
function readIso(text: string, local: boolean): Instant | undefined {
  const m = ISO_DATE_TIME.exec(text.trim());
  if (!m) return undefined;
  const n = (i: number) => Number(m[i] ?? '0');
  const [y, mo, d, h, mi, s] = [n(1), n(2), n(3), n(4), n(5), n(6)];
  if (y < YEAR_MIN || y > YEAR_MAX || !realDay(y, mo - 1, d)) return undefined;
  if (h > 23 || mi > 59 || s > 59) return undefined;
  const offset = m[7];
  const bracket = m[8] && isTimeZone(m[8]) ? m[8] : undefined;
  if (offset === undefined) {
    if (!local) return undefined;
    const zone = bracket ?? viewerZone();
    const ms = zonedInstant(dayOf(y, mo - 1, d), h, mi, bracket);
    return { ms, zone };
  }
  const minutes = offsetMinutes(offset);
  if (Math.abs(minutes) > 18 * 60) return undefined;
  const ms = Date.UTC(y, mo - 1, d, h, mi) - minutes * MINUTE_MS;
  return bracket ? { ms, zone: bracket } : { ms };
}

// A stored (or any ISO 8601, offset given) moment, or undefined for anything else.
export function readInstant(value: unknown): Instant | undefined {
  return typeof value === 'string' ? readIso(value, false) : undefined;
}

export const isInstantValue = (value: unknown): boolean => readInstant(value) !== undefined;

// A moment written by a person or an agent as the field stores it, or undefined when it is none. Agents give the
// offset (`local` off); Import CSV may leave it out (`local`), read in the importer's zone.
export function parseDateTime(text: string, opts: { local?: boolean } = {}): string | undefined {
  const at = readIso(text, opts.local === true);
  return at ? instantValue(at.ms, at.zone) : undefined;
}

// A moment as agents and CSV read it: its UTC instant, the zone left out (`2026-10-31T17:00:00Z`).
export function instantIso(value: unknown): string | undefined {
  const at = readInstant(value);
  return at ? instantValue(at.ms) : undefined;
}

// A moment moved by whole days, keeping its wall-clock time in `tz` and its zone: across a clock change a 09:00
// meeting stays at 09:00.
export function shiftInstant(value: unknown, days: number, tz?: string): string | undefined {
  const at = readInstant(value);
  if (!at) return undefined;
  const p = zonedParts(at.ms, tz);
  const ms = zonedInstant(dayOf(p.year, p.month, p.date) + days, p.hour, p.minute, tz);
  return instantValue(ms, at.zone);
}

// A moment on `day`: the value's own time of day in `tz` when it has one, else TIMED_DEFAULT_HOUR, stamped with its
// zone (or the viewer's).
export function instantOnDay(value: unknown, day: number, tz?: string): string {
  const at = readInstant(value);
  const p = at ? zonedParts(at.ms, tz) : { hour: TIMED_DEFAULT_HOUR, minute: 0 };
  return instantValue(zonedInstant(day, p.hour, p.minute, tz), at?.zone ?? tz ?? viewerZone());
}

const pad = (n: number) => String(n).padStart(2, '0');

// A moment as a `datetime-local` box shows it in `tz`: `YYYY-MM-DDTHH:MM`; '' for none.
export function localInputValue(value: unknown, tz?: string): string {
  const at = readInstant(value);
  if (!at) return '';
  const p = zonedParts(at.ms, tz);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.date)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

// A `datetime-local` box's text, read in `tz`, as the field stores it with that zone; undefined when it is no whole
// moment.
export function fromLocalInput(text: string, tz?: string): string | undefined {
  const m = LOCAL_INPUT.exec(text);
  if (!m) return undefined;
  const [y, mo, d, h, mi] = [1, 2, 3, 4, 5].map((i) => Number(m[i])) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (y < YEAR_MIN || !realDay(y, mo - 1, d) || h > 23 || mi > 59) return undefined;
  const ms = zonedInstant(dayOf(y, mo - 1, d), h, mi, tz);
  return instantValue(ms, tz ?? viewerZone());
}

// How a moment reads: on a card (`short`), "Fri 31 Oct, 17:00", the year added when it is not `now`'s; in the panel
// (`medium`) always with its year. In the viewer's locale and clock.
type DateTimeStyle = 'short' | 'medium';

const textFormatters = new Map<string, Intl.DateTimeFormat>();

function textFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = textFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, options);
    textFormatters.set(key, f);
  }
  return f;
}

// Whether a moment is shown with its year: always in the panel, on a card only when not `now`'s year.
function withYear(ms: number, style: DateTimeStyle, tz: string | undefined, now: number): boolean {
  return style === 'medium' || zonedParts(ms, tz).year !== zonedParts(now, tz).year;
}

// One moment's words, with or without its weekday.
export function momentText(
  ms: number,
  opts: { tz?: string; year: boolean; weekday: boolean; time?: boolean },
): string {
  const time = opts.time !== false;
  const key = `${opts.tz ?? ''}|${opts.year}|${opts.weekday}|${time}`;
  return textFormatter(key, {
    ...(opts.weekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    ...(opts.year ? { year: 'numeric' } : {}),
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
    ...(opts.tz ? { timeZone: opts.tz } : {}),
  }).format(ms);
}

// A moment's time of day in the viewer's clock ("17:00", "5:00 PM"), as a calendar day prints it before a title.
export function timeOfDayText(ms: number, tz?: string): string {
  return textFormatter(`time|${tz ?? ''}`, {
    hour: '2-digit',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  }).format(ms);
}

export function dateTimeText(
  value: unknown,
  style: DateTimeStyle = 'short',
  opts: { tz?: string; now?: number } = {},
): string | null {
  const at = readInstant(value);
  if (!at) return null;
  const year = withYear(at.ms, style, opts.tz, opts.now ?? Date.now());
  return momentText(at.ms, { tz: opts.tz, year, weekday: true });
}

// Where a moment is read (docs/specs/026-plan/item-types.md "Date and Time"): the viewer's zone named, and the time it
// was set as in its own zone when that is another ("Your time, Europe/London · Set as Fri 31 Oct, 13:00 in
// America/New_York"), drawn under the panel's box.
export function dateTimeZones(value: unknown, tz?: string): string | null {
  const at = readInstant(value);
  if (!at) return null;
  const here = tz ?? viewerZone();
  const own =
    at.zone && at.zone !== here
      ? ` · Set as ${momentText(at.ms, { tz: at.zone, year: false, weekday: true })} in ${at.zone}`
      : '';
  return `Your time, ${here}${own}`;
}
