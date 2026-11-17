// History's pure rules (livediagram/docs/specs/013-workspace/history.md "The dialog"): the day headings, the
// runs of one kind by one person that fold into one entry, the kinds a filter chip offers, the summary strip, and a
// person's avatar colour. No React here, so each is tested on its own.

import type { ItemEvent } from '@liveworkspace/index-client';
import { PRESENCE_COLOURS } from '@liveworkspace/settings/presence';
import { WEEKDAY } from '@liveworkspace/ui/date-format';
import {
  dateKey,
  eventCategory,
  formatDay,
  sortCategories,
  type EventCategory,
} from './history-model';

export { HISTORY_PAGE } from '@liveworkspace/index-client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday", the weekday within the last week, then "Tue, 5 Aug" (with its year when not this year's). */
export function historyDayLabel(key: string, now: number): string {
  if (key === dateKey(now)) return 'Today';
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(y!, m! - 1, d);
  if (Number.isNaN(day.getTime())) return key;
  const today = new Date(now);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // Rounded, so a clock change inside the span does not shift a day.
  const ago = Math.round((midnight - day.getTime()) / DAY_MS);
  if (ago === 1) return 'Yesterday';
  if (ago > 1 && ago < 7) return WEEKDAY.format(day);
  const { label, year, withYear } = formatDay(key);
  return year !== String(today.getFullYear()) ? withYear : label;
}

/** One entry on the rail: an event alone, or a run of one kind by one person (newest first). */
export type HistoryRun = { key: string; events: ItemEvent[] };

export type HistoryDay = { key: string; label: string; runs: HistoryRun[]; count: number };

const sameRun = (a: ItemEvent, b: ItemEvent) =>
  a.type === b.type && (a.actorId ?? '') === (b.actorId ?? '');

/** Newest-first events into days, each day's consecutive events of one kind by one person folded into a run. One
 *  pass, linear in the events. */
export function buildHistory(events: readonly ItemEvent[], now: number): HistoryDay[] {
  const days: HistoryDay[] = [];
  let day: HistoryDay | null = null;
  let run: HistoryRun | null = null;
  for (const event of events) {
    const key = dateKey(event.occurredAt);
    if (!day || day.key !== key) {
      day = { key, label: historyDayLabel(key, now), runs: [], count: 0 };
      days.push(day);
      run = null;
    }
    if (run && sameRun(run.events[0]!, event)) run.events.push(event);
    else {
      run = { key: event.id, events: [event] };
      day.runs.push(run);
    }
    day.count += 1;
  }
  return days;
}

/** The kinds the loaded events hold, in a fixed order, and how many of each: the filter's chips. */
/** An entry another tool lays on the rail (a snapshot, owner 2026-11-17): placed by when it happened. */
export type HistoryPinAt = { key: string; at: number };
export type HistoryEntryOf<P> = { run: HistoryRun; pin?: never } | { pin: P; run?: never };
export type PinnedHistoryDay<P> = {
  key: string;
  label: string;
  count: number;
  pinned: number;
  entries: HistoryEntryOf<P>[];
};

/** The days with pins laid among their runs, newest first (a pin on a day with no events makes that day). Linear in
 *  the runs plus the pins, but for one sort per day that holds a pin. */
export function pinHistory<P extends HistoryPinAt>(
  days: readonly HistoryDay[],
  pins: readonly P[],
  now: number,
): PinnedHistoryDay<P>[] {
  const out = new Map<string, PinnedHistoryDay<P>>();
  for (const day of days)
    out.set(day.key, { ...day, pinned: 0, entries: day.runs.map((run) => ({ run })) });
  for (const pin of pins) {
    const key = dateKey(pin.at);
    let day = out.get(key);
    if (!day) {
      day = { key, label: historyDayLabel(key, now), count: 0, pinned: 0, entries: [] };
      out.set(key, day);
    }
    day.entries.push({ pin });
    day.pinned += 1;
  }
  const at = (e: HistoryEntryOf<P>) => (e.pin ? e.pin.at : e.run!.events[0]!.occurredAt);
  const result = [...out.values()];
  for (const day of result) if (day.pinned) day.entries.sort((a, b) => at(b) - at(a));
  return result.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

export function historyCategories(
  events: readonly ItemEvent[],
): { category: EventCategory; count: number }[] {
  const counts = new Map<EventCategory, number>();
  for (const event of events) {
    const category = eventCategory(event.type);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return sortCategories(counts.keys()).map((category) => ({
    category,
    count: counts.get(category)!,
  }));
}

export function filterHistory(
  events: readonly ItemEvent[],
  category: EventCategory | null,
): readonly ItemEvent[] {
  return category ? events.filter((e) => eventCategory(e.type) === category) : events;
}

export type HistorySummary = {
  count: number;
  // The people who took part, newest first: their ids and the event that names them.
  people: ItemEvent[];
};

export function summariseHistory(events: readonly ItemEvent[]): HistorySummary {
  const seen = new Map<string, ItemEvent>();
  for (const event of events) {
    if (event.actorId && !seen.has(event.actorId)) seen.set(event.actorId, event);
  }
  return { count: events.length, people: [...seen.values()] };
}

/** "3 events", "30+ events" while older ones remain. */
export function eventCountLabel(count: number, more: boolean): string {
  return `${count}${more ? '+' : ''} ${count === 1 && !more ? 'event' : 'events'}`;
}

/** A person's avatar colour: one of the presence palette's, the same for them every time. The index holds no
 *  profile colours, so this is picked from their id rather than asked for. */
export function personColour(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PRESENCE_COLOURS[Math.abs(hash) % PRESENCE_COLOURS.length]!.value;
}
