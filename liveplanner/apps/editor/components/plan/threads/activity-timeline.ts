// The Activity tab's timeline shape (docs/specs/026-plan/items.md "History" "Where it shows"): a card's history
// entries (newest first) in day groups (Today, Yesterday, then dates), each day in runs of one person's entries close
// together, and, for every set or cleared field, what it held before where the card's older history says. Pure.

import type { ItemHistoryEntry, ItemHistoryValue } from '@liveplanner/items';
import type { PreviousValue } from './activity-words';

// Entries by one person this close together (and on one day) hang from one disc.
export const ACTIVITY_RUN_GAP_MS = 30 * 60_000;

export type TimelineEntry = {
  entry: ItemHistoryEntry;
  // Per change, in order: what the field held before.
  previous: readonly PreviousValue[];
};

export type TimelineRun = {
  key: string;
  by: ItemHistoryEntry['by'];
  mine: boolean;
  ai: boolean;
  entries: TimelineEntry[];
};

export type TimelineDay = { key: string; heading: string; runs: TimelineRun[] };

// For each entry (newest first), each change's earlier value: walked from the oldest, tracking every field's last
// known value. A field named but not copied (a description) is unknown from there on.
export function previousValues(entries: readonly ItemHistoryEntry[]): PreviousValue[][] {
  const known = new Map<string, ItemHistoryValue | null>();
  const out: PreviousValue[][] = Array.from({ length: entries.length }, () => []);
  for (let i = entries.length - 1; i >= 0; i--) {
    out[i] = entries[i]!.changes.map((c) => {
      if (c.kind !== 'set' && c.kind !== 'cleared') return undefined;
      const before = known.get(c.field);
      if (c.kind === 'cleared') known.set(c.field, null);
      else if (c.value === undefined) known.delete(c.field);
      else known.set(c.field, c.value);
      return before;
    });
  }
  return out;
}

const dayKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// A day group's heading: Today, Yesterday, else the date in the viewer's own words, with the year when not this one.
export function dayHeading(at: number, now: number): string {
  const key = dayKey(at);
  if (key === dayKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday.getTime())) return 'Yesterday';
  const d = new Date(at);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }),
  });
}

const sameAuthor = (a: ItemHistoryEntry, b: ItemHistoryEntry) =>
  a.by.name === b.by.name &&
  a.by.color === b.by.color &&
  !!a.mine === !!b.mine &&
  (a.tag === 'ai') === (b.tag === 'ai');

// The first `limit` entries as days of runs; earlier values read from every entry, shown or not.
export function activityTimeline(
  entries: readonly ItemHistoryEntry[],
  now: number,
  limit = entries.length,
): TimelineDay[] {
  const previous = previousValues(entries);
  const days: TimelineDay[] = [];
  entries.slice(0, limit).forEach((entry, i) => {
    const key = dayKey(entry.at);
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, heading: dayHeading(entry.at, now), runs: [] };
      days.push(day);
    }
    const run = day.runs.at(-1);
    const last = run?.entries.at(-1)?.entry;
    const item = { entry, previous: previous[i]! };
    if (run && last && sameAuthor(last, entry) && last.at - entry.at <= ACTIVITY_RUN_GAP_MS) {
      run.entries.push(item);
      return;
    }
    day.runs.push({
      key: `${entry.at}-${i}`,
      by: entry.by,
      mine: !!entry.mine,
      ai: entry.tag === 'ai',
      entries: [item],
    });
  });
  return days;
}
