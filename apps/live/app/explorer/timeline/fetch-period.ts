// The calendar's on-demand period fetch (docs/specs/013-workspace/timeline.md §2.2): every page of
// one month, not only the first. A busy month holds more than one page of TIMELINE_PAGE_MAX events,
// and stopping after the first left the rest of the month's days empty, as if nothing had happened.
//
// Its own module, like merge-events, so the paging rules are tested without rendering the hook.

import type { TimelineEvent } from '@livediagram/ui';
import type { TimelinePage } from '@/lib/api/timeline';

// The most pages one month is followed through: 10 pages of TIMELINE_PAGE_MAX (200) is 2,000
// events in a month, far past any real feed, and it bounds the requests a runaway cursor can make.
// Safe range 1 to ~50; past the cap the month shows what was read and the cap is logged.
export const TIMELINE_PERIOD_PAGES_MAX = 10;

export type PeriodOutcome = 'complete' | 'capped' | 'failed' | 'cancelled';

export async function fetchPeriod(
  fetchPage: (cursor: string | undefined) => Promise<TimelinePage | null>,
  onPage: (events: TimelineEvent[]) => void,
  isCancelled: () => boolean,
): Promise<PeriodOutcome> {
  let cursor: string | undefined;
  for (let page = 0; page < TIMELINE_PERIOD_PAGES_MAX; page += 1) {
    const read = await fetchPage(cursor);
    if (isCancelled()) return 'cancelled';
    if (!read) return 'failed';
    // Each page lands as it arrives, so the month fills in rather than waiting for the last one.
    if (read.events.length > 0) onPage(read.events);
    if (!read.nextCursor) return 'complete';
    cursor = read.nextCursor;
  }
  console.warn('[timeline] period.capped', { pages: TIMELINE_PERIOD_PAGES_MAX });
  return 'capped';
}
