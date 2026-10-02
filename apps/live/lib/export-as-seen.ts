// A tab as the author sees it, for export (docs/specs/023-whiteboard/path-tool.md "Export, sharing
// and import"; docs/specs/023-whiteboard/whiteboard.md "Appearance"): the resolved backdrop for the
// viewer's appearance and editor mode, and with the board look (Draw mode) every unpainted element
// in the board's ink, as the canvas draws it (projectWhiteboardElement: named marker colours in
// their version for that board), so an export matches the board.
import {
  hasBoardLook,
  projectWhiteboardElement,
  type Appearance,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';
import { resolveTabBackdrop } from './themes';

export function tabAsSeen(
  tab: Tab,
  mode: EditorMode,
  appearance: Appearance = getResolvedAppearance(),
): Tab {
  const backdrop = resolveTabBackdrop(tab, mode, appearance);
  if (!hasBoardLook(mode)) return { ...tab, ...backdrop };
  return {
    ...tab,
    ...backdrop,
    elements: tab.elements.map((el) => projectWhiteboardElement(el, appearance)),
  };
}
