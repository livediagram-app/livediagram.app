// What the index's listings know of a plan's content (docs/specs/015-api/api.md "Storage"): the summary the
// plan's Durable Object pushes (plan-room/plan-outbox.ts), never a tab body.

// The column's JSON. `firstTabCount` is the first tab's element count (-1 while unknown, null with no tab);
// `tabCounts` each tab's, for a tab-scoped reader; `stats` the Details view's numbers (tab-stats.ts); and
// `hasContent` whether any tab holds an element, a form or a body that is not JSON, or the plan holds a card or a sheet
// (the index's empty clean-up reads it).
export type ContentSummary = {
  firstTabCount: number | null;
  tabCounts: Record<string, number>;
  stats: { mode: string; elements: number; comments: number; bytes: number } | null;
  hasContent: boolean;
};

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}
