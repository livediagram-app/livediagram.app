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

// UTC everywhere, not local. The day boundary has to match the one the
// worker used when it built a coalesced event's dedupe key, or a save
// at 23:30 in Sydney would land in a bubble labelled the day before.
export function dateKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
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
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { label: key, year: '' };
  // Assembled from parts rather than taken from a single format call:
  // ICU 72 and below emit "Tue 5 Aug" while 73+ emit "Tue, 5 Aug", and
  // a label that differs between a developer's machine and CI is a
  // snapshot test that fails for no reason.
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return { label: `${weekday}, ${day} ${month}`, year: String(date.getUTCFullYear()) };
}
