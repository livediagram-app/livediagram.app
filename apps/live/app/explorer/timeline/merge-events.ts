// Merging one read's events into the ones already on screen (spec/138
// §2.4a).
//
// Two of the feed's three reads merge rather than replace — the
// re-read on returning to the tab, which brings new events in at the
// head, and the calendar's on-demand period fetch, which brings older
// ones in from the middle. Both need the same three things: drop what
// we already have, keep everything we had, and hand back a list that is
// still newest-first, because the day grouping and the stacking both
// assume that order.
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
