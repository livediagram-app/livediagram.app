// A Timeline read again on coming back to the tab (livediagram/docs/specs/013-workspace/timeline.md "Coming back to
// the tab"): its first page merged in at the head of what is shown. Pure.

import type { TimelineEvent } from '@liveworkspace/index-client';

const newestFirst = (a: TimelineEvent, b: TimelineEvent) =>
  b.occurredAt - a.occurredAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * The first page read again, merged with what is shown: every event once, the fresh copy winning (an `edited`
 * moves on, an item renamed since), newest first. Pages already loaded stay, so a reader far down the feed keeps
 * their place. Nothing new: the same array, so nothing re-renders.
 */
export function mergeHead(
  shown: TimelineEvent[],
  fresh: readonly TimelineEvent[],
): TimelineEvent[] {
  if (fresh.length === 0) return shown;
  const byId = new Map(shown.map((event) => [event.id, event]));
  let changed = false;
  for (const event of fresh) {
    const had = byId.get(event.id);
    // Read again unchanged: kept as it is. A page is at most TIMELINE_LIMIT_MAX events, so this stays small.
    if (had && JSON.stringify(had) === JSON.stringify(event)) continue;
    byId.set(event.id, event);
    changed = true;
  }
  if (!changed) return shown;
  return [...byId.values()].sort(newestFirst);
}
