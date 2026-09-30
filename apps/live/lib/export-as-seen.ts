// A tab as the author sees it, for export (docs/specs/023-whiteboard/path-tool.md "Export, sharing
// and import"; docs/specs/023-whiteboard/whiteboard.md "Appearance"): the resolved backdrop for the
// viewer's appearance, and on a whiteboard every unpainted element in the board's ink, as the
// canvas draws it (inkWhiteboardElement), so an export matches the board.
import {
  WHITEBOARD_INK,
  inkWhiteboardElement,
  isWhiteboardTab,
  type Appearance,
  type Tab,
} from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';
import { resolveTabBackdrop } from './themes';

export function tabAsSeen(tab: Tab, appearance: Appearance = getResolvedAppearance()): Tab {
  const backdrop = resolveTabBackdrop(tab, appearance);
  if (!isWhiteboardTab(tab)) return { ...tab, ...backdrop };
  const ink = WHITEBOARD_INK[appearance];
  return { ...tab, ...backdrop, elements: tab.elements.map((el) => inkWhiteboardElement(el, ink)) };
}
