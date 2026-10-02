// A tab as the author sees it, for export (docs/specs/007-editor/editor-modes.md "One look"): the
// tab's own Diagram backdrop resolved for the export's appearance, whoever exports and in
// whichever editor mode, and every stock colour stored by name in its version for that canvas, so
// every export format (the image renderers and the text formats alike) draws what the canvas does.
import {
  canvasSurface,
  resolveStockColours,
  type Appearance,
  type Tab,
} from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';
import { resolveTabBackdrop } from './themes';

export function tabAsSeen(tab: Tab, appearance: Appearance = getResolvedAppearance()): Tab {
  const backdrop = resolveTabBackdrop(tab, appearance);
  const surface = canvasSurface(backdrop.backgroundColor);
  return {
    ...tab,
    ...backdrop,
    elements: tab.elements.map((el) => resolveStockColours(el, surface)),
  };
}
