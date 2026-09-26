// Merging one read's events into the ones already on screen (docs/specs/013-workspace/timeline.md
// §2.4a, §2.4b).
//
// Two of the feed's reads merge rather than replace — the re-read on
// returning to the tab or after the reader's own write, which brings
// new events in at the head, and the calendar's on-demand period fetch,
// which brings older ones in from the middle. Both need the same three
// things: drop what we already have, keep everything we had, and hand
// back a list that is still newest-first, because the day grouping and
// the stacking both assume that order.
//
// Its own module (and not a closure inside useTimelineFeed) so the
// ordering rules can be tested directly rather than through a hook that
// would need a DOM to run.

import type { TimelineEvent } from '@livediagram/ui';

export function mergeEvents(prev: TimelineEvent[], incoming: TimelineEvent[]): TimelineEvent[] {
  const known = new Set(prev.map((e) => e.id));
  const fresh = incoming.filter((e) => !known.has(e.id));
  // Identity, not just a shortcut: returning `prev` unchanged keeps the
  // state update a no-op, so a re-read that found nothing new doesn't
  // re-render the whole feed (and re-run its arrival cascade).
  if (fresh.length === 0) return prev;
  // Fresh first so that when a re-read and a loaded page carry the same
  // instant — the coalesced "saved today" row is the common case — the
  // newer copy wins the tie in this stable sort and lands above.
  return [...fresh, ...prev].sort((a, b) => b.occurredAt - a.occurredAt);
}

// A first-page re-read, treated as authoritative for the stretch of
// time it covers (docs/specs/013-workspace/timeline.md §2.4b).
//
// A plain merge only ever adds, so after the reader deletes a diagram
// the worker's cascade (§3.5) has removed its cards from the server
// while the copies on screen stay put — and a rename's coalesced edit
// event, which the worker upserts in place, keeps its old time and old
// snapshot. This reconciles both: within the window the page spans,
// whatever the page doesn't hold is gone, and whatever it does hold is
// the page's copy. Loaded pages older than the window can't be judged
// from this read and are kept as they were.
//
// The window's floor is the page's oldest event when there is a next
// page, or the beginning of time when the page IS the whole feed.
// Events sharing the floor's instant are kept: keyset paging orders
// ties by id, so some of them legitimately live on the next page.
export function reconcileEvents(
  prev: TimelineEvent[],
  page: { events: TimelineEvent[]; nextCursor?: string },
): TimelineEvent[] {
  const incoming = new Map(page.events.map((e) => [e.id, e]));
  const last = page.events[page.events.length - 1];
  const floor = page.nextCursor && last ? last.occurredAt : Number.NEGATIVE_INFINITY;
  let changed = false;
  const kept: TimelineEvent[] = [];
  for (const e of prev) {
    const fresh = incoming.get(e.id);
    if (fresh) {
      if (sameEvent(fresh, e)) {
        kept.push(e);
      } else {
        changed = true;
        kept.push(fresh);
      }
    } else if (e.occurredAt > floor) {
      changed = true;
    } else {
      kept.push(e);
    }
  }
  const merged = mergeEvents(kept, page.events);
  // Same identity rule as mergeEvents: nothing changed, nothing re-renders.
  return !changed && merged === kept ? prev : merged;
}

// The fields a re-emit can move on an existing row: the coalesced edit
// event walks `occurredAt` forward and refreshes its snapshot on every
// save (docs/specs/013-workspace/timeline.md §4.2). Compared by value — the two copies come from
// different JSON parses, so identity would call every row changed.
function sameEvent(a: TimelineEvent, b: TimelineEvent): boolean {
  return (
    a.occurredAt === b.occurredAt &&
    a.title === b.title &&
    a.description === b.description &&
    JSON.stringify(a.snapshot ?? null) === JSON.stringify(b.snapshot ?? null)
  );
}

// The client half of the worker's delete cascade (docs/specs/013-workspace/timeline.md §3.5): drop
// every card about an entity that no longer exists. Same predicate as
// `markTimelineEventsDeletedBySource` — keyed on the id, or referencing
// it from the snapshot under `<sourceType>Id` — so a comment on the
// deleted diagram goes the way its own cards do.
export function purgeEventsForSource(
  events: TimelineEvent[],
  sourceType: string,
  sourceId: string,
): TimelineEvent[] {
  const key = `${sourceType}Id`;
  const kept = events.filter(
    (e) =>
      e.sourceType !== sourceType ||
      (e.sourceId !== sourceId &&
        (e.snapshot as Record<string, unknown> | undefined)?.[key] !== sourceId),
  );
  return kept.length === events.length ? events : kept;
}
