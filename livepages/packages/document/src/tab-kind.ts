// What KIND a tab is (docs/specs/003-system-architecture/domain-language.md). A leaf module: the Tab type
// imports the union, and the editor's commit choke point stamps it.
//
// The set is TOTAL — 'diagram' is a real member, not an absence — so code
// switches over a complete union and a new kind can't be quietly
// forgotten in a branch. "Ordinary tab" is a thing the model can say.

// livepages has one kind: every tab is a general tab, drawn as pages.
export type TabKind = 'diagram';

export const DEFAULT_TAB_KIND: TabKind = 'diagram';

// Tabs written before the field existed (every row already in D1, every
// IndexedDB record, every exported JSON) carry no `kind`, and that will be
// true forever — no migration reaches an exported file or someone else's
// offline copy. So absence MUST keep reading as the default, whatever new
// tabs store, and so does a kind this build does not have (a livediagram Board tab reads as an ordinary tab).
export function tabKindOf(_tab: { kind?: string } | undefined): TabKind {
  return DEFAULT_TAB_KIND;
}

// Write the resolved kind onto a tab, so a saved tab says what it is rather
// than leaving the reader to know the convention.
//
// Returns the SAME object when nothing needs stamping: this runs at the
// editor's commit choke point over every tab of every commit, and minting a
// fresh object for an unchanged tab would ripple through the memoised views
// downstream for no reason.
export function stampTabKind<T extends { kind?: string }>(tab: T): T {
  if (tab.kind !== undefined) return tab;
  return { ...tab, kind: DEFAULT_TAB_KIND };
}
