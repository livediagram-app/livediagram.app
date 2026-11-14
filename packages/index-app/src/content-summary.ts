// What an item's Durable Object tells the index of its content (each product's docs/specs/015-api/api.md "Storage"),
// read from its own tables (each product's room outbox, readContentSummary) and pushed as the item's summary, never a
// tab body. The Explorer's Details view and its thumbnails read it there; the content itself is the Durable Object's.

// `firstTabCount` is the first tab's element count (-1 while unknown, null with no tab); `tabCounts` each tab's, for
// a tab-scoped reader; `stats` the Details view's numbers (tab-stats.ts), with the mode of the tab written last where
// the product keeps one; and `hasContent` whether the item holds anything (each product says what counts).
export type ContentSummary = {
  firstTabCount: number | null;
  tabCounts: Record<string, number>;
  stats: { mode?: string; elements: number; comments: number; bytes: number } | null;
  hasContent: boolean;
  // Listed in the public Community (the outbox's readContentSummary); absent where it was not read.
  communityListed?: boolean;
};

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}
