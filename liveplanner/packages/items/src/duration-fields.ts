// Duration fields (docs/specs/026-plan/item-types.md "Duration"): how long something takes or took, stored as whole
// minutes under the field's id, typed as "2h 30m", "90m", "1.5h" or "2:30" and read back as "2h 30m". A Duration
// field that tracks time (Time Spent, time-tracking.ts) holds entries instead, and reads as their total. This is the
// one reading every surface shares (the card face, the panel, sort, CSV, formulas, rollups, widgets, agents). Pure.
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import type { Item, ItemFieldValue, ItemPerson } from './item';
import { readTimeValue, timePerson, timeTotal } from './time-tracking';

// The longest duration a field holds: 99,999 hours, in minutes.
export const DURATION_HOURS_MAX = 99_999;
export const DURATION_MINUTES_MAX = DURATION_HOURS_MAX * 60;
// What the panel and the agents say when text is no duration.
export const DURATION_HINT = 'Write a duration like 2h 30m, 90m or 1.5h';

type DurationDef = Pick<CustomFieldDef, 'kind'> & Partial<Pick<CustomFieldDef, 'timeSpent'>>;

// A Duration field that tracks time (Time Spent): its value is entries, never typed in.
export const isTimeSpent = (f: DurationDef | undefined): boolean =>
  f?.kind === 'duration' && f.timeSpent === true;

// Whole minutes held to 0..DURATION_MINUTES_MAX, or undefined for anything else.
function minutesIn(n: number): number | undefined {
  if (!Number.isFinite(n) || n < 0) return undefined;
  const m = Math.round(n);
  return m <= DURATION_MINUTES_MAX ? m : undefined;
}

// "2h 30m", "2 hours 30 mins", "1.5h", "90m", "45m" ...: one or more number-and-unit parts, read left to right by
// hand: a regex scan over the parts was polynomial on a long run of digits (CodeQL js/polynomial-redos).
const HOURS = new Set(['h', 'hr', 'hrs', 'hour', 'hours']);
const MINUTES = new Set(['m', 'min', 'mins', 'minute', 'minutes']);
const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isLetter = (c: string | undefined) => c !== undefined && c >= 'a' && c <= 'z';
const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);
const CLOCK = /^(\d+):([0-5]?\d)$/;
const BARE = /^(\d+(?:\.\d+)?|\.\d+)$/;

// A duration as typed (the panel, Import CSV, agents, the CLI), as whole minutes; undefined when it is none. A
// number is minutes; text reads "2h 30m", "2h30m", "1.5h", "90m", "2:30" (hours and minutes) or a bare number
// (minutes), ignoring case and spaces, rounded to a whole minute.
export function parseDuration(v: string | number | undefined | null): number | undefined {
  if (typeof v === 'number') return minutesIn(v);
  if (typeof v !== 'string') return undefined;
  const text = v.trim().toLowerCase();
  if (text === '') return undefined;
  const clock = CLOCK.exec(text);
  if (clock) return minutesIn(Number(clock[1]) * 60 + Number(clock[2]));
  if (BARE.test(text)) return minutesIn(Number(text));
  // Parts with only spaces and commas between them, so "2h banana" is refused rather than read as 2h.
  let total = 0;
  let parts = 0;
  let at = 0;
  for (;;) {
    while (text[at] === ',' || isSpace(text[at])) at += 1;
    if (at === text.length) break;
    // The number: digits with an optional fraction ("1.5"), or a fraction alone (".5").
    const start = at;
    while (isDigit(text[at])) at += 1;
    if (text[at] === '.' && isDigit(text[at + 1])) {
      at += 1;
      while (isDigit(text[at])) at += 1;
    }
    if (at === start) return undefined;
    const amount = Number(text.slice(start, at));
    while (isSpace(text[at])) at += 1;
    // The unit: the whole run of letters, so "2hx" is refused.
    const unitStart = at;
    while (isLetter(text[at])) at += 1;
    const unit = text.slice(unitStart, at);
    if (HOURS.has(unit)) total += amount * 60;
    else if (MINUTES.has(unit)) total += amount;
    else return undefined;
    parts += 1;
  }
  return parts ? minutesIn(total) : undefined;
}

// A duration as it reads: "2h 30m", "45m", "3h", "0m"; hours past a day stay hours, grouped as the reader's locale
// groups digits ("1,250h").
export function durationText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  const hours = `${h.toLocaleString()}h`;
  return rest === 0 ? hours : `${hours} ${rest}m`;
}

// The same, spoken: "2 hours 30 minutes", "1 minute", "0 minutes".
export function durationSpoken(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const unit = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
  if (h === 0) return unit(rest, 'minute');
  return rest === 0 ? unit(h, 'hour') : `${unit(h, 'hour')} ${unit(rest, 'minute')}`;
}

// Everyone with a timer running on a card, in any Time Spent field its type offers, earliest first (each person once),
// and the earliest start: what the card face's running pill draws (docs/specs/026-plan/item-types.md "Time Spent").
// Null with none running.
export function runningOnCard(
  item: Pick<Item, 'fields'>,
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
): { people: ItemPerson[]; start: number } | null {
  const runs: { person: ItemPerson; start: number }[] = [];
  for (const f of type.custom ?? []) {
    if (!isTimeSpent(f) || !type.fields.includes(f.id)) continue;
    const value = readTimeValue(item.fields[f.id]);
    for (const r of value.running) runs.push({ person: timePerson(value, r.by), start: r.start });
  }
  if (runs.length === 0) return null;
  runs.sort((a, b) => a.start - b.start);
  const people: ItemPerson[] = [];
  for (const r of runs) if (!people.some((p) => p.id === r.person.id)) people.push(r.person);
  return { people, start: runs[0]!.start };
}

// A Duration field's value on a card as every reader takes it: whole minutes, or undefined for none. A stray value
// written straight to the field (text, a negative) reads as none; a Time Spent field reads as its entries' total
// (none until it has an entry).
export function durationMinutes(
  field: DurationDef,
  raw: ItemFieldValue | undefined,
): number | undefined {
  if (field.kind !== 'duration') return undefined;
  if (isTimeSpent(field)) {
    const value = readTimeValue(raw);
    return value.entries.length ? timeTotal(value) : undefined;
  }
  return typeof raw === 'number' ? minutesIn(raw) : undefined;
}
