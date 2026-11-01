// Date Range fields (docs/specs/026-plan/item-types.md "Date Range"): a start and an end in one field, stored as a
// list of its two ends, start first: two days (`YYYY-MM-DD`) or, with Include Time (`withTime`), two Date and Time
// instants (date-time-fields.ts). Agents and CSV read and write it as an ISO 8601 interval, "start/end". Pure.
import type { CustomFieldDef } from './item-types';
import type { ItemFieldValue } from './item';
import { validDate } from './fields';
import {
  instantIso,
  momentText,
  parseDateTime,
  readInstant,
  timeOfDayText,
  zonedDay,
  zonedParts,
} from './date-time-fields';

export interface DateRange {
  start: string;
  end: string;
  // Whether its ends are instants (Include Time) rather than days.
  timed: boolean;
}

export type DateRole = 'start' | 'due';

// Whether a Date Range field's ends carry a time.
export const isTimedRange = (field: Pick<CustomFieldDef, 'kind' | 'withTime'>): boolean =>
  field.kind === 'daterange' && field.withTime === true;

const msOf = (end: string) => readInstant(end)!.ms;

// Two ends in order, the earlier first: days compare as text, instants by their moment.
export function rangeValue(a: string, b: string): [string, string] {
  const timed = readInstant(a) !== undefined;
  const later = timed ? msOf(a) > msOf(b) : a > b;
  return later ? [b, a] : [a, b];
}

// A stored range, in order; undefined unless it is two days or two instants.
export function readRange(value: ItemFieldValue | undefined): DateRange | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [a, b] = value;
  if (typeof a !== 'string' || typeof b !== 'string') return undefined;
  if (validDate(a) && validDate(b)) {
    const [start, end] = rangeValue(a, b);
    return { start, end, timed: false };
  }
  if (readInstant(a) && readInstant(b)) {
    const [start, end] = rangeValue(a, b);
    return { start, end, timed: true };
  }
  return undefined;
}

// The end a role reads: `start` the first, `due` the last (docs/specs/026-plan/plan-views.md "Times and ranges").
export function rangeEndOf(value: ItemFieldValue | undefined, role: DateRole): string | undefined {
  const r = readRange(value);
  return r ? (role === 'start' ? r.start : r.end) : undefined;
}

// A range with one end set: the other end moved to it when they would cross, or both set to it when there was none.
export function rangeWithEnd(
  value: ItemFieldValue | undefined,
  role: DateRole,
  end: string,
): [string, string] {
  const r = readRange(value);
  if (!r) return [end, end];
  if (role === 'start') {
    const [, last] = rangeValue(end, r.end);
    return [end, last === end ? end : r.end];
  }
  const [first] = rangeValue(r.start, end);
  return [first === end ? end : r.start, end];
}

// The interval separators a range is written with: " to " when the text has one (its days may be day-first, 31/10/2026),
// else ISO 8601's "/". Read by a hand-written scanner, not /\s+to\s+/, which slows to a crawl on long runs of spaces.
const isSpace = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);
const endsOf = (text: string): string[] => {
  const parts: string[] = [];
  let from = 0;
  let i = 0;
  while (i < text.length) {
    if (!isSpace(text[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (isSpace(text[j])) j += 1;
    if (text.slice(j, j + 2).toLowerCase() === 'to' && isSpace(text[j + 2])) {
      let k = j + 2;
      while (isSpace(text[k])) k += 1;
      parts.push(text.slice(from, i));
      from = k;
      i = k;
    } else i = j;
  }
  if (parts.length === 0) return text.split('/');
  parts.push(text.slice(from));
  return parts;
};

// A range written by a person, an agent or a file as the field stores it, or undefined. `input` is a list of two
// ends or text ("2026-10-31/2026-11-02", "2026-10-31 to 2026-11-02"); each end is a day read by `readDay` (YYYY-MM-DD
// by default) or, `withTime`, a moment (`parseDateTime`, its offset needed unless `local`).
export function parseDateRange(
  input: unknown,
  withTime: boolean,
  opts: { local?: boolean; readDay?: (text: string) => string | undefined } = {},
): [string, string] | undefined {
  const parts = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? endsOf(input.trim())
      : [];
  if (parts.length !== 2 || parts.some((p) => typeof p !== 'string')) return undefined;
  const readDay = opts.readDay ?? ((t: string) => (validDate(t.trim()) ? t.trim() : undefined));
  const ends = (parts as string[]).map((p) =>
    withTime ? parseDateTime(p, { local: opts.local }) : readDay(p),
  );
  if (!ends[0] || !ends[1]) return undefined;
  return rangeValue(ends[0], ends[1]);
}

// A range as agents and CSV read it: "start/end", each timed end its UTC instant.
export function rangeIso(value: ItemFieldValue | undefined): string | undefined {
  const r = readRange(value);
  if (!r) return undefined;
  return r.timed ? `${instantIso(r.start)}/${instantIso(r.end)}` : `${r.start}/${r.end}`;
}

// A range's first and last day in `tz` (a range of days is its own days whatever the zone).
export function rangeDays(
  value: ItemFieldValue | undefined,
  tz?: string,
): { start: number; end: number } | undefined {
  const r = readRange(value);
  if (!r) return undefined;
  const day = (end: string) =>
    r.timed ? zonedDay(msOf(end), tz) : Math.round(Date.parse(`${end}T00:00:00Z`) / 86_400_000);
  return { start: day(r.start), end: day(r.end) };
}

// How a range reads (docs/specs/026-plan/item-types.md "Date Range"): on a card (`short`) "31 Oct to 2 Nov", each end
// with its year when not `now`'s; in the panel (`medium`) with years. A range of one day is that day; with times,
// "31 Oct, 09:00 to 2 Nov, 17:00", or "31 Oct, 09:00 to 17:00" within one day, in the viewer's zone.
export function dateRangeText(
  value: ItemFieldValue | undefined,
  style: 'short' | 'medium' = 'short',
  opts: { tz?: string; now?: number } = {},
): string | null {
  const r = readRange(value);
  if (!r) return null;
  const now = opts.now ?? Date.now();
  const thisYear = zonedParts(now, opts.tz).year;
  const ms = (end: string) => (r.timed ? msOf(end) : Date.UTC(...dayParts(end)) + 12 * 3_600_000);
  // A day's words are the day as it is, never shifted by a zone: drawn at its UTC noon in UTC.
  const tz = r.timed ? opts.tz : 'UTC';
  const year = (end: string) => style === 'medium' || zonedParts(ms(end), tz).year !== thisYear;
  const word = (end: string) =>
    momentText(ms(end), { tz, year: year(end), weekday: false, time: r.timed });
  const days = rangeDays(value, opts.tz)!;
  if (days.start === days.end) {
    if (!r.timed) return word(r.start);
    if (r.start === r.end) return word(r.start);
    return `${word(r.start)} to ${timeOfDayText(ms(r.end), opts.tz)}`;
  }
  return `${word(r.start)} to ${word(r.end)}`;
}

function dayParts(day: string): [number, number, number] {
  return [Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))];
}

// Whether a Date and Time or a Date Range has passed (docs/specs/026-plan/item-types.md "Past due"): a moment, or a
// timed range's end, to the minute; a range of days when its last day is before today in `tz`. Never another kind.
export function pastDue(
  field: Pick<CustomFieldDef, 'kind'>,
  value: ItemFieldValue | undefined,
  now: number = Date.now(),
  tz?: string,
): boolean {
  if (field.kind === 'datetime') {
    const at = readInstant(value);
    return at !== undefined && at.ms < now;
  }
  if (field.kind !== 'daterange') return false;
  const r = readRange(value);
  if (!r) return false;
  return r.timed ? msOf(r.end) < now : rangeDays(value)!.end < zonedDay(now, tz);
}
