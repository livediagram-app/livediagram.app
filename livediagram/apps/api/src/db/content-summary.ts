// What a canvas tells the index of its content (docs/specs/015-api/api.md "Storage"), read from its own tables by
// its Durable Object (document-room/document-outbox.ts readContentSummary) and pushed as the item's summary, never a
// tab body. The Explorer's Details view and its thumbnails read it there; the content itself is the Durable Object's.

// `firstTabCount` is the first tab's element count (-1 while unknown, null with no tab); `tabCounts` each tab's, for
// a tab-scoped reader; `stats` the Details view's numbers (tab-stats.ts), with the mode of the tab written last; and
// `hasContent` whether any tab holds an element or a page.
export type ContentSummary = {
  firstTabCount: number | null;
  tabCounts: Record<string, number>;
  stats: { mode?: string; elements: number; comments: number; bytes: number } | null;
  hasContent: boolean;
};

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}
