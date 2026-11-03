// What KIND a tab is. A leaf module: the Tab type imports the union, and the editor's commit choke point
// stamps it.
//
// The set is TOTAL: 'diagram' is a real member, not an absence, so code
// switches over a complete union and "ordinary tab" is a thing the model can say.

// Whiteboarding is an editor mode, not a kind (docs/specs/007-editor/editor-modes.md): a stored
// 'whiteboard' is migrated on read into a general tab that opens in Draw (./legacy-whiteboard-tab). The Plan
// kinds (board, sheet, dashboard, form) moved out to liveplanner: one stored reads as 'diagram' (./retired-plan).
export type TabKind = 'diagram';

export const DEFAULT_TAB_KIND: TabKind = 'diagram';

// Tabs written before the field existed (every IndexedDB record, every exported JSON) carry no `kind`,
// and a tab from another product may carry a kind this product does not have. Both read as the default.
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
  if (tab.kind === DEFAULT_TAB_KIND) return tab;
  return { ...tab, kind: DEFAULT_TAB_KIND };
}
