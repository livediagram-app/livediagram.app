// The Explorer events no app sends any more, shared by every app's retired-events.ts
// (docs/specs/013-workspace/history.md, docs/specs/017-telemetry/telemetry.md "Retired features"):
// - The Explorer's Timeline and Home's What Happened, retired in every app in November 2026: the whole Timeline
//   category (its views, filters, pages, cards, runs, menus and removals, and the old arrivals), What Happened's
//   opens and summaries, See Timeline, and the sidebar rows that led to the Timeline. An old `/explorer/timeline`
//   page view stays: it is a page view like any other.
// - Home's Landing and Nav arrivals (`Home·Opened·Landing` / `Nav`), which stopped when the Explorer moved to
//   liveworkspace.app: only the first-run Home (`Home·Opened·Welcome`) is still reported.

// The categories retired whole. Each app's schema keeps them so stored rows still validate, but the dashboard
// drops them before anything renders, so no config gives them a colour.
export const RETIRED_CATEGORIES = ['Timeline'] as const;
export type RetiredCategory = (typeof RETIRED_CATEGORIES)[number];

const RETIRED_CATEGORY_SET: ReadonlySet<string> = new Set(RETIRED_CATEGORIES);

const RETIRED_EXPLORER_EVENTS = new Set([
  'Home|Selected|WhatHappened',
  'Home|Selected|SeeTimeline',
  'Home|Opened|Group',
  'Home|Opened|Landing',
  'Home|Opened|Nav',
  'UI|Selected|Sidebar.Timeline',
  'UI|Selected|ExplorerPanel.Timeline',
]);

/** Whether an event is one of the Explorer's retired ones: the Timeline's, What Happened's or Home's old arrivals. */
export function isRetiredExplorerEvent(
  category: string,
  action: string,
  type: string | null,
): boolean {
  return (
    RETIRED_CATEGORY_SET.has(category) ||
    RETIRED_EXPLORER_EVENTS.has(`${category}|${action}|${type ?? ''}`)
  );
}
