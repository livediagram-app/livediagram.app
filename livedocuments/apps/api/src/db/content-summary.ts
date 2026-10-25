// What the index's listings know of a document's content (docs/specs/015-api/api.md "Storage"): the summary the
// document's Durable Object pushes (document-room/document-outbox.ts), never a tab body.

// The column's JSON. `firstTabCount` is the first tab's element count (-1 while unknown, null with no tab);
// `tabCounts` each tab's, for a tab-scoped reader; `stats` the Details view's numbers (tab-stats.ts); and
// `hasContent` whether any tab holds an element or a page (the sweep's test).
export type ContentSummary = {
  firstTabCount: number | null;
  tabCounts: Record<string, number>;
  stats: { elements: number; comments: number; bytes: number } | null;
  hasContent: boolean;
};

// No tab, or a counted tab with no elements. A count not yet known is not empty: its preview is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}
