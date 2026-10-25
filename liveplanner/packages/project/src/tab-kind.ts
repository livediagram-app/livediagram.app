// What KIND a tab is (docs/specs/003-system-architecture/domain-language.md). A leaf module: the Tab type
// imports the union, and the editor's commit choke point stamps it.
//
// The set is TOTAL — 'diagram' is a real member, not an absence — so code
// switches over a complete union and a new kind can't be quietly
// forgotten in a branch. "Ordinary tab" is a thing the model can say.

// Whiteboarding is an editor mode, not a kind (docs/specs/007-editor/editor-modes.md): a stored
// Board, Sheet and Dashboard are the Plan tab kinds (docs/specs/026-plan/plan-tabs.md), and Form
// (docs/specs/030-forms/forms.md).
export type TabKind = 'diagram' | 'board' | 'sheet' | 'dashboard' | 'form';

export const PLAN_TAB_KINDS = ['board', 'sheet', 'dashboard', 'form'] as const;
export type PlanTabKind = (typeof PLAN_TAB_KINDS)[number];

// The tab is a Board, Sheet, Dashboard or Form tab: always in Plan mode.
export function isPlanTabKind(kind: string | undefined): kind is PlanTabKind {
  return kind === 'board' || kind === 'sheet' || kind === 'dashboard' || kind === 'form';
}

export const DEFAULT_TAB_KIND: TabKind = 'diagram';

// Tabs written before the field existed (every row already in D1, every
// IndexedDB record, every exported JSON) carry no `kind`, and that will be
// true forever — no migration reaches an exported file or someone else's
// offline copy. So absence MUST keep reading as the default, whatever new
// tabs store, and so does a kind this build no longer has (a stored
// 'event-storming' board reads as an ordinary tab).
export function tabKindOf(tab: { kind?: string } | undefined): TabKind {
  switch (tab?.kind) {
    case 'board':
    case 'sheet':
    case 'dashboard':
    case 'form':
      return tab.kind;
    default:
      return DEFAULT_TAB_KIND;
  }
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
