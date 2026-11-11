// The Explorer's Timeline and Home's What Happened, retired in every app in November 2026
// (docs/specs/013-workspace/history.md, docs/specs/017-telemetry/telemetry.md "Retired features"): the whole
// Timeline category (its views, filters, pages, cards, runs, menus and removals, and the old arrivals), What
// Happened's opens and summaries, See Timeline, and the sidebar rows that led to the Timeline. An old
// `/explorer/timeline` page view stays: it is a page view like any other.
const WHAT_HAPPENED_AND_ROWS = new Set([
  'Home|Selected|WhatHappened',
  'Home|Selected|SeeTimeline',
  'Home|Opened|Group',
  'UI|Selected|Sidebar.Timeline',
  'UI|Selected|ExplorerPanel.Timeline',
]);

/** Whether an event is the retired Timeline's or What Happened's. */
export function isRetiredTimelineEvent(
  category: string,
  action: string,
  type: string | null,
): boolean {
  return (
    category === 'Timeline' || WHAT_HAPPENED_AND_ROWS.has(`${category}|${action}|${type ?? ''}`)
  );
}
