// Day grouping for the feed (spec/138 §2).
//
// Pure functions plus a memo hook, so the grouping can be tested
// directly and reused by a layout that doesn't mount <Timeline>.

import { useMemo } from 'react';
import type { TimelineEvent } from './types';

export type TimelineDayGroup = {
  // YYYY-MM-DD, UTC. Doubles as the React key and the scroll target.
  key: string;
  // "Tue, 5 Aug"
  label: string;
  // "2026"
  year: string;
  // Today's group leads with a pill and a brighter rail dot.
  isToday: boolean;
  // Forward-dated events (an expiring token, an expiring share link)
  // sit above Today in their own tinted band.
  isFuture: boolean;
  events: TimelineEvent[];
};

// The reader's LOCAL day, not UTC.
//
// The worker's coalescing key is UTC and has to be — one row is shared
// by an audience spread across timezones, so the day boundary that
// decides whether two saves merge cannot depend on who is looking. But
// DISPLAY is the opposite: a reader in Sydney opening this at 09:00
// should see their morning's work under today, not under yesterday,
// which is what a UTC label gives them for a third of the day.
//
// So the two boundaries are deliberately different, and that's fine:
// the key decides what merges, this decides what a person is told.
export function dateKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Time of day, in the reader's locale. A day with twenty events is
// ordered but undated without this — you can see that Priya commented
// and that you renamed something, but not which came first.
export function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function groupByDay(events: TimelineEvent[], now = Date.now()): TimelineDayGroup[] {
  const todayKey = dateKey(now);
  // A Map rather than "start a new group when the key changes": the
  // server orders by occurred_at, but a future-dated expiry event can
  // arrive interleaved, and adjacency-based grouping would then emit
  // two groups with the same key — a duplicate React key, and half the
  // day's bubbles silently dropped from the render.
  const byKey = new Map<string, TimelineDayGroup>();
  const order: string[] = [];

  for (const event of events) {
    const key = dateKey(event.occurredAt);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        ...formatDay(key),
        isToday: key === todayKey,
        isFuture: key > todayKey,
        events: [],
      };
      byKey.set(key, group);
      order.push(key);
    }
    group.events.push(event);
  }

  return order.map((key) => byKey.get(key)!);
}

export function useTimelineGrouping(events: TimelineEvent[], now?: number): TimelineDayGroup[] {
  return useMemo(() => groupByDay(events, now), [events, now]);
}

function formatDay(key: string): { label: string; year: string } {
  // Parsed as local midnight (no trailing Z), matching how dateKey
  // built it. `new Date('2026-08-05')` would be parsed as UTC and could
  // render the previous day west of Greenwich.
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  if (Number.isNaN(date.getTime())) return { label: key, year: '' };
  // Assembled from parts rather than taken from a single format call:
  // ICU 72 and below emit "Tue 5 Aug" while 73+ emit "Tue, 5 Aug", and
  // a label that differs between a developer's machine and CI is a
  // snapshot test that fails for no reason.
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return { label: `${weekday}, ${day} ${month}`, year: String(date.getFullYear()) };
}
