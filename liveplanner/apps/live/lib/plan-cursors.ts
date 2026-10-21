// Peers' cursors on a Plan tab (docs/specs/026-plan/plan-mode.md "Collaboration"): a Board or Sheet tab, or any
// tab worked on in Plan mode but a Dashboard, shows no participant cursors (the board or Sheet covers the canvas they
// would point at). A Dashboard shows them, as a diagram does.
import { opensInOf, tabKindOf, type Tab } from '@liveplanner/document';

export function planHidesCursors(tab: Tab | undefined): boolean {
  if (!tab) return false;
  const kind = tabKindOf(tab);
  if (kind === 'dashboard') return false;
  return kind === 'board' || kind === 'sheet' || opensInOf(tab) === 'plan';
}
