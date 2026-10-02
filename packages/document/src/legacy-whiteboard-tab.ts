// Loading a tab saved as `kind: 'whiteboard'` (docs/specs/007-editor/editor-modes.md "Existing
// whiteboards"). Whiteboarding is an editor mode now, so such a tab becomes a general tab that
// OPENS in Draw mode. Runs where stored tabs enter (./stored-tab), never in `stampTabKind`.
//
// "One look": a board drew its unpainted shapes, lines and paths in the ink with no fill, as a
// display projection. Diagram mode has no such projection, so those colours are written onto the
// elements here, Ink by name (adaptive per appearance), so the board looks unchanged in either
// mode and to every collaborator. Pen strokes and text with no colour of their own draw in Ink in
// both modes already, so they keep their colour unset; a stroke only loses a fill it never showed.
// An unset background read as Plain on a board and the theme's pattern on a general tab, so it is
// written down as Plain.
import { INK_PEN_COLOUR } from './pen-colours';
import { WHITEBOARD_INKED_SHAPES, WHITEBOARD_UNSET_PATTERN } from './whiteboard';
import type { Element, Tab } from './index';

const LEGACY_WHITEBOARD_KIND = 'whiteboard';

type ColourFields = {
  strokeColor?: string;
  penColour?: string;
  fillColor?: string;
  textColor?: string;
  penTextColour?: string;
};

const unset = (own: string | undefined, named?: string) => own === undefined && named === undefined;

// Only the fields the board's projection supplied, so a painted element stays the same object.
function inkPatch(el: Element): ColourFields {
  const c = el as ColourFields;
  const line = unset(c.strokeColor, c.penColour) ? { penColour: INK_PEN_COLOUR } : {};
  const unfilled = c.fillColor === undefined ? { fillColor: 'transparent' } : {};
  switch (el.type) {
    case 'shape':
      if (!WHITEBOARD_INKED_SHAPES.has(el.shape)) return {};
      return {
        ...line,
        ...unfilled,
        ...(unset(c.textColor, c.penTextColour) ? { penTextColour: INK_PEN_COLOUR } : {}),
      };
    case 'path':
      return { ...line, ...unfilled };
    case 'arrow':
      return line;
    case 'freehand':
      return el.pen === 'highlighter' ? {} : unfilled;
    default:
      return {};
  }
}

function inkElement(el: Element): Element {
  const patch = inkPatch(el);
  return Object.keys(patch).length === 0 ? el : ({ ...el, ...patch } as Element);
}

export function migrateWhiteboardKind<T extends Pick<Tab, 'elements' | 'backgroundPattern'>>(
  tab: T,
): T {
  const stored = tab as T & { id?: string; kind?: string };
  if (stored.kind !== LEGACY_WHITEBOARD_KIND) return tab;
  const elements = Array.isArray(tab.elements) ? tab.elements.map(inkElement) : tab.elements;
  const inked = Array.isArray(tab.elements)
    ? elements.filter((el, i) => el !== tab.elements[i]).length
    : 0;
  console.info('[editor-mode] whiteboard tab migrated to Draw', { tabId: stored.id, inked });
  return {
    ...tab,
    kind: 'diagram',
    opensIn: 'draw',
    backgroundPattern: tab.backgroundPattern ?? WHITEBOARD_UNSET_PATTERN,
    elements,
  };
}
