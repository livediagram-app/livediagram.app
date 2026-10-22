// Peers' cursors on a Plan tab (docs/specs/026-plan/plan-mode.md "Collaboration"): every tab but a Dashboard shows
// no participant cursors (the board or Sheet covers the canvas they would point at). A Dashboard shows them.
import { tabKindOf, type Tab } from '@liveplanner/project';

export function planHidesCursors(tab: Tab | undefined): boolean {
  return !!tab && tabKindOf(tab) !== 'dashboard';
}
