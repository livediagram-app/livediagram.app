// What KIND of board a tab is (spec/139). A leaf module: the Tab type
// imports the union, and the editor's commit choke point stamps it.
//
// The set is TOTAL — 'diagram' is a real member, not an absence — so code
// switches over a complete union and a future third kind can't be quietly
// forgotten in a branch. "Ordinary board" is a thing the model can say.
import type { Layer } from './layers';
import { isEventStormingTab } from './event-storming';

export type TabKind = 'diagram' | 'event-storming';

export const DEFAULT_TAB_KIND: TabKind = 'diagram';

// Tabs written before the field existed (every row already in D1, every
// IndexedDB record, every exported JSON) carry no `kind`, and that will be
// true forever — no migration reaches an exported file or someone else's
// offline copy. So absence MUST keep reading as the default, whatever new
// tabs store.
export function tabKindOf(tab: { kind?: string } | undefined): TabKind {
  return tab?.kind === 'event-storming' ? 'event-storming' : DEFAULT_TAB_KIND;
}

// Write the resolved kind onto a tab, so a saved tab says what it is rather
// than leaving the reader to know the convention.
//
// The stamp is a ONE-WAY write — whatever it puts on a tab is what that tab
// is from then on — so it resolves the kind exactly as a READER would,
// legacy signals included. A board authored before the field is recognised
// by the layer its template shipped; branding it 'diagram' would take its
// palette, stationery and note menu away permanently, and no later load
// could tell that had happened.
//
// Returns the SAME object when nothing needs stamping: this runs at the
// editor's commit choke point over every tab of every commit, and minting a
// fresh object for an unchanged tab would ripple through the memoised views
// downstream for no reason.
export function stampTabKind<T extends { kind?: string; layers?: Layer[] }>(tab: T): T {
  if (tab.kind !== undefined) return tab;
  return { ...tab, kind: isEventStormingTab(tab) ? 'event-storming' : DEFAULT_TAB_KIND };
}
