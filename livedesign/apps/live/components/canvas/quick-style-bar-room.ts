// The room the Quick Style bar takes beside its page's title bar with its buttons named
// (docs/specs/008-canvas/quick-style-panel.md "Named while the title bar is"), worked out from its buttons rather than
// measured, so the title bar can decide whether both fit named before the bar draws either way.
import { titleBarChromeRoom } from '@liveworkspace/workbench/components/canvas/PageTitleBar';
import type { QuickBarSectionId } from './quick-style-sections';

// Screen px between the bar and the title bar (the row's `gap-2`), counted in the room the bar takes.
export const QUICK_STYLE_BAR_GAP = 8;

// A named button's room less its name: its padding, its icon and the gap between them.
const NAMED_BUTTON = 40;
// Each button's name at the bar's 12 px medium type, rounded up with a little to spare for other system fonts.
const NAME_WIDTH: Record<QuickBarSectionId, number> = {
  penColour: 44,
  penWidth: 27,
  highlighterColour: 68,
  highlighterWidth: 62,
  stroke: 41,
  background: 19,
  textColour: 27,
  width: 37,
  style: 27,
  textAlign: 32,
  iconAlign: 27,
};

/** The bar's room with these buttons named, the gap to the title bar included; 0 with none. */
export function quickStyleBarNamedRoom(ids: readonly QuickBarSectionId[]): number {
  if (ids.length === 0) return 0;
  const buttons = ids.reduce((sum, id) => sum + NAMED_BUTTON + NAME_WIDTH[id], 0);
  return buttons + titleBarChromeRoom(ids.length, 1) + QUICK_STYLE_BAR_GAP;
}
