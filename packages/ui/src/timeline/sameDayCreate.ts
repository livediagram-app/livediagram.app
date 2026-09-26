// Created and updated on the same day (docs/specs/013-workspace/timeline.md §2.1a).
//
// A diagram made this morning and worked on this afternoon produces two
// events: `diagram_created` and the coalesced `diagram_edited`. Shown
// side by side under Today they are the same card twice, and the second
// one tells the reader nothing the first didn't: of course a new diagram
// was edited on the day it was made.
//
// So the edit goes whenever its create shares the reader's local day.
// Pure over the event list, so the rule is testable without mounting
// anything, and applied to `visibleEvents` so the list, the calendar's
// dots and the mini-calendar all agree. The stored rows are untouched.

import type { TimelineEvent } from './types';
import { dateKey } from './useTimelineGrouping';

function diagramIdOf(event: TimelineEvent): string | null {
  // Optional chaining: a fixture or an older wire row can arrive with no
  // snapshot at all, and a missing id just means "not this rule".
  const id = event.snapshot?.['diagramId'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function collapseSameDayCreate(events: readonly TimelineEvent[]): TimelineEvent[] {
  // `<diagramId>|<local day>` for every create in the list.
  const created = new Set<string>();
  for (const event of events) {
    if (event.eventType !== 'diagram_created') continue;
    const id = diagramIdOf(event);
    if (id) created.add(`${id}|${dateKey(event.occurredAt)}`);
  }
  if (created.size === 0) return [...events];

  return events.filter((event) => {
    if (event.eventType !== 'diagram_edited') return true;
    const id = diagramIdOf(event);
    return !id || !created.has(`${id}|${dateKey(event.occurredAt)}`);
  });
}
