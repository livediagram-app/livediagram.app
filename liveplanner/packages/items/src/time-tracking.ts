// Time Spent (docs/specs/026-plan/item-types.md "Time Spent"): a Duration field that tracks time holds its entries
// (spans someone spent) and its running timers (started, not yet stopped) instead of a typed value. Every change is
// one time write made to the card as stored (start, stop, add, remove, put), never a whole value written over another,
// so two people's timers and entries never overwrite each other. The api, an offline plan and the editor's optimistic
// copy all apply the same pure step here. Pure.
import type { Item, ItemFieldValue, ItemPerson } from './item';
import { isObj } from './validate';

// The most entries and running timers, together, one field holds on a card: a card stays well within its fields'
// 16 KB (an entry is about 70 bytes, each person named once).
export const TIME_ENTRIES_MAX = 100;
// A timer stopped before half a minute rounds to 0 and records nothing.
export const MINUTE_MS = 60_000;
// The longest single entry: a Duration's most (99,999 hours).
const ENTRY_MINUTES_MAX = 99_999 * 60;
// An entry's or a timer's id, and a person id as items carry it.
const TIME_ID = /^[A-Za-z0-9_-]{6,32}$/;
const PERSON_ID_MAX = 64;
const NAME_MAX = 120;
const COLOUR = /^#[0-9a-fA-F]{3,8}$/;

export type TimeEntry = { id: string; by: string; minutes: number; at: number };
export type RunningTimer = { id: string; by: string; start: number };
export type TimePeople = Record<string, { name: string; color: string }>;
export type TimeValue = { people: TimePeople; entries: TimeEntry[]; running: RunningTimer[] };

export const EMPTY_TIME_VALUE: TimeValue = { people: {}, entries: [], running: [] };

// One time write: the caller's timer started, a timer stopped (its time recorded as entry `entry`), a manual entry
// added, an entry or a running timer removed, or an entry put back as it was (the undo of a remove).
export type TimeOp =
  | { op: 'start'; timer: string }
  | { op: 'stop'; timer: string; entry: string }
  | { op: 'add'; entry: string; minutes: number }
  | { op: 'remove'; entry: string }
  | { op: 'put'; entry: TimeEntry; person: ItemPerson };

const isId = (v: unknown): v is string => typeof v === 'string' && TIME_ID.test(v);
const isPersonId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= PERSON_ID_MAX;
const isWhen = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 8.64e15;
const isMinutes = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= ENTRY_MINUTES_MAX;

function readEntry(raw: unknown): TimeEntry | null {
  if (!isObj(raw)) return null;
  const { id, by, minutes, at } = raw;
  return isId(id) && isPersonId(by) && isMinutes(minutes) && isWhen(at)
    ? { id, by, minutes, at }
    : null;
}

function readRunning(raw: unknown): RunningTimer | null {
  if (!isObj(raw)) return null;
  const { id, by, start } = raw;
  return isId(id) && isPersonId(by) && isWhen(start) ? { id, by, start } : null;
}

function readPeople(raw: unknown): TimePeople {
  const out: TimePeople = {};
  if (!isObj(raw)) return out;
  for (const [id, p] of Object.entries(raw)) {
    if (!isPersonId(id) || !isObj(p)) continue;
    const name = typeof p.name === 'string' ? p.name.slice(0, NAME_MAX) : 'Someone';
    const color = typeof p.color === 'string' && COLOUR.test(p.color) ? p.color : '#94a3b8';
    out[id] = { name, color };
  }
  return out;
}

// A Time Spent field's value as every reader takes it: what it holds that reads, malformed rows dropped, ids once;
// empty for anything that is no time value (a typed Duration left from before, a stray value).
export function readTimeValue(raw: ItemFieldValue | undefined): TimeValue {
  if (!isObj(raw)) return EMPTY_TIME_VALUE;
  const seen = new Set<string>();
  const once = <T extends { id: string }>(row: T | null): row is T => {
    if (!row || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  };
  const entries = Array.isArray(raw.entries) ? raw.entries.map(readEntry).filter(once) : [];
  const running = Array.isArray(raw.running) ? raw.running.map(readRunning).filter(once) : [];
  return { people: readPeople(raw.people), entries, running };
}

// A time value a create carries across (an undo of a delete, a sync, a copy), checked whole: null when any part of
// it does not read, or it holds more than a field may.
export function carriedTimeValue(raw: unknown): TimeValue | null {
  if (!isObj(raw) || !Array.isArray(raw.entries) || !Array.isArray(raw.running)) return null;
  if (Object.keys(raw).some((k) => k !== 'people' && k !== 'entries' && k !== 'running'))
    return null;
  const value = readTimeValue(raw as ItemFieldValue);
  if (value.entries.length !== raw.entries.length || value.running.length !== raw.running.length)
    return null;
  if (value.entries.length + value.running.length > TIME_ENTRIES_MAX) return null;
  return value;
}

// The minutes a field's entries add up to; a running timer joins it when it stops.
export const timeTotal = (value: TimeValue): number =>
  value.entries.reduce((n, e) => n + e.minutes, 0);

// A person a time value names, with a fallback for one it lost.
export function timePerson(value: TimeValue, id: string): ItemPerson {
  const p = value.people[id];
  return { id, name: p?.name ?? 'Someone', color: p?.color ?? '#94a3b8' };
}

// The running timer `personId` has on the field, if any.
export const runningTimerOf = (value: TimeValue, personId: string): RunningTimer | undefined =>
  value.running.find((r) => r.by === personId);

// The whole minutes a timer ran from `start` to `now`: half a minute and more rounds up.
export const timerMinutes = (start: number, now: number): number =>
  Math.max(0, Math.round((now - start) / MINUTE_MS));

// A running timer's elapsed time as it ticks: "0:05", "12:05", then "1:02:05" past the hour (minutes and seconds,
// hours once there are any); never below 0 (a clock a little behind the server's).
export function elapsedClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// A time write as sent (the api's body, an offline write), or why not.
export function readTimeOp(raw: unknown): TimeOp | 'time_invalid' {
  if (!isObj(raw)) return 'time_invalid';
  switch (raw.op) {
    case 'start':
      return isId(raw.timer) ? { op: 'start', timer: raw.timer } : 'time_invalid';
    case 'stop':
      return isId(raw.timer) && isId(raw.entry)
        ? { op: 'stop', timer: raw.timer, entry: raw.entry }
        : 'time_invalid';
    case 'add':
      return isId(raw.entry) && isMinutes(raw.minutes)
        ? { op: 'add', entry: raw.entry, minutes: raw.minutes }
        : 'time_invalid';
    case 'remove':
      return isId(raw.entry) ? { op: 'remove', entry: raw.entry } : 'time_invalid';
    case 'put': {
      const entry = readEntry(raw.entry);
      const person = raw.person;
      if (!entry || !isObj(person) || person.id !== entry.by) return 'time_invalid';
      const people = readPeople({ [entry.by]: person });
      const p = people[entry.by]!;
      return { op: 'put', entry, person: { id: entry.by, name: p.name, color: p.color } };
    }
    default:
      return 'time_invalid';
  }
}

// Whose timer or entry a write touches, for the share roles (docs/specs/026-plan/item-types.md "Time Spent"): the
// caller for a start or an add, the timer's or entry's person for a stop, a remove or a put; null when the target is
// not there (the write then changes nothing).
export function timeOpOwner(value: TimeValue, op: TimeOp, callerId: string): string | null {
  switch (op.op) {
    case 'start':
    case 'add':
      return callerId;
    case 'stop':
      return value.running.find((r) => r.id === op.timer)?.by ?? null;
    case 'remove':
      return (
        value.entries.find((e) => e.id === op.entry)?.by ??
        value.running.find((r) => r.id === op.entry)?.by ??
        null
      );
    case 'put':
      return op.entry.by;
  }
}

type TimeContext = { now: number; by: ItemPerson };
// What a time write did: the value after it (unchanged when it had nothing to do), or a refusal.
export type TimeStep =
  { ok: true; value: TimeValue; changed: boolean } | { ok: false; error: 'time_full' };

// Keeps `people` to the persons the value names, with `named` (the writer) refreshed.
function withPeople(value: TimeValue, named: ItemPerson[]): TimeValue {
  const people: TimePeople = {};
  const ids = new Set([...value.entries.map((e) => e.by), ...value.running.map((r) => r.by)]);
  for (const id of ids) if (value.people[id]) people[id] = value.people[id]!;
  for (const p of named) if (ids.has(p.id)) people[p.id] = { name: p.name, color: p.color };
  return { ...value, people };
}

const full = (value: TimeValue) => value.entries.length + value.running.length >= TIME_ENTRIES_MAX;
const unchanged = (value: TimeValue): TimeStep => ({ ok: true, value, changed: false });

// One time write applied to a field's value. A start while the caller's timer runs, a stop of a timer already gone
// (stopped on another device) and a remove of something already gone change nothing; a timer stopped before half a
// minute leaves no entry.
export function applyTimeOpTo(value: TimeValue, op: TimeOp, ctx: TimeContext): TimeStep {
  switch (op.op) {
    case 'start': {
      if (runningTimerOf(value, ctx.by.id) || value.running.some((r) => r.id === op.timer))
        return unchanged(value);
      if (full(value)) return { ok: false, error: 'time_full' };
      const running = [...value.running, { id: op.timer, by: ctx.by.id, start: ctx.now }];
      return { ok: true, value: withPeople({ ...value, running }, [ctx.by]), changed: true };
    }
    case 'stop': {
      const timer = value.running.find((r) => r.id === op.timer);
      if (!timer) return unchanged(value);
      const running = value.running.filter((r) => r.id !== op.timer);
      const minutes = Math.min(ENTRY_MINUTES_MAX, timerMinutes(timer.start, ctx.now));
      const taken = value.entries.some((e) => e.id === op.entry);
      const entries =
        minutes > 0 && !taken
          ? [...value.entries, { id: op.entry, by: timer.by, minutes, at: ctx.now }]
          : value.entries;
      return { ok: true, value: withPeople({ ...value, running, entries }, []), changed: true };
    }
    case 'add': {
      if (value.entries.some((e) => e.id === op.entry)) return unchanged(value);
      if (full(value)) return { ok: false, error: 'time_full' };
      const entries = [
        ...value.entries,
        { id: op.entry, by: ctx.by.id, minutes: op.minutes, at: ctx.now },
      ];
      return { ok: true, value: withPeople({ ...value, entries }, [ctx.by]), changed: true };
    }
    case 'remove': {
      const entries = value.entries.filter((e) => e.id !== op.entry);
      const running = value.running.filter((r) => r.id !== op.entry);
      if (entries.length === value.entries.length && running.length === value.running.length)
        return unchanged(value);
      return { ok: true, value: withPeople({ ...value, entries, running }, []), changed: true };
    }
    case 'put': {
      if (value.entries.some((e) => e.id === op.entry.id)) return unchanged(value);
      if (full(value)) return { ok: false, error: 'time_full' };
      const entries = [...value.entries, op.entry].sort((a, b) => a.at - b.at);
      return { ok: true, value: withPeople({ ...value, entries }, [op.person]), changed: true };
    }
  }
}

// A field's value as stored: absent once it holds nothing, so a card with no time keeps no key.
function stored(value: TimeValue): ItemFieldValue | undefined {
  if (value.entries.length === 0 && value.running.length === 0) return undefined;
  return {
    people: value.people,
    entries: value.entries,
    running: value.running,
  };
}

// One time write applied to a card's field: the card after it (its rev raised; Last Edited stays, as a tally leaves
// it, since tracking time is no edit of the card), the card as it was when it changed nothing, or a refusal.
export function applyTimeOp(
  item: Item,
  field: string,
  op: TimeOp,
  ctx: TimeContext,
): { ok: true; item: Item } | { ok: false; error: 'time_full' } {
  const step = applyTimeOpTo(readTimeValue(item.fields[field]), op, ctx);
  if (!step.ok) return step;
  if (!step.changed) return { ok: true, item };
  const fields = { ...item.fields };
  const next = stored(step.value);
  if (next === undefined) delete fields[field];
  else fields[field] = next;
  return { ok: true, item: { ...item, fields, rev: item.rev + 1 } };
}

// The write that undoes `op` on a card as it was before it (docs/specs/026-plan/item-types.md "Time Spent", Undo):
// an add's is a remove, an entry's remove puts it back; a start, a stop and a timer's discard are no undo step.
export function inverseTimeOp(item: Item, field: string, op: TimeOp): TimeOp | null {
  if (op.op === 'add') return { op: 'remove', entry: op.entry };
  if (op.op === 'put') return { op: 'remove', entry: op.entry.id };
  if (op.op !== 'remove') return null;
  const value = readTimeValue(item.fields[field]);
  const entry = value.entries.find((e) => e.id === op.entry);
  return entry ? { op: 'put', entry, person: timePerson(value, entry.by) } : null;
}
