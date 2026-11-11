// Loading a tab saved as `kind: 'whiteboard'` (docs/specs/007-editor/editor-modes.md "What a tab
// written elsewhere keeps"). A whiteboard is no kind of tab any more, so such a tab becomes a general
// tab, which livehuddle opens on its one meeting board (livehuddle has no Draw mode). Runs where
// stored tabs enter (./stored-tab), never in `stampTabKind`.
//
// "One look": a board drew its unpainted square, circle, triangle and diamond in the ink with no fill, as a display
// projection, and those colours used to be written onto them here. Those kinds are retired elements now
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5), kept exactly as stored, as are
// strokes, paths and arrows (part 4), so nothing on a board is repainted.
// A board's text boxes hugged their text, so each keeps hugging (`sizing`, docs/specs/007-editor/
// editor-modes.md "What a tab written elsewhere keeps"): an auto width fits its words, any other
// wraps at its width.
// An unset background read as Plain on a board and the theme's pattern on a general tab, so it is
// written down as Plain.
import { WHITEBOARD_UNSET_PATTERN } from './whiteboard';
import type { Element, Tab } from './index';

const LEGACY_WHITEBOARD_KIND = 'whiteboard';

// A board's text box as a hugging one: its stored auto width read as 'fit', else 'wrap'.
function hugText(el: Element): Element {
  if (el.type !== 'text' || el.sizing !== undefined) return el;
  const { autoWidth, ...rest } = el as Element & { autoWidth?: unknown };
  return { ...rest, sizing: autoWidth === true ? 'fit' : 'wrap' } as Element;
}

export function migrateWhiteboardKind<T extends Pick<Tab, 'elements' | 'backgroundPattern'>>(
  tab: T,
): T {
  const stored = tab as T & { id?: string; kind?: string };
  if (stored.kind !== LEGACY_WHITEBOARD_KIND) return tab;
  const elements = Array.isArray(tab.elements) ? tab.elements.map(hugText) : tab.elements;
  console.info('[editor-mode] whiteboard tab migrated to Draw', { tabId: stored.id });
  return {
    ...tab,
    kind: 'diagram',
    opensIn: 'draw',
    backgroundPattern: tab.backgroundPattern ?? WHITEBOARD_UNSET_PATTERN,
    elements,
  };
}
