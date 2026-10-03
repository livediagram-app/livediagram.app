// The quick style panel's Highlighter rows (docs/specs/008-canvas/highlighter.md "Settings"): the
// colour and width of the selected highlight strokes or, with nothing selected and the Highlighter
// tile armed, of the next stroke. The marker's own five colours and three widths, not the theme's.
import type { Element, FreehandElement } from '@livediagram/document';
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_WIDTH,
  highlighterWidthId,
  highlighterWidthPx,
  type HighlighterWidthId,
} from './highlighter-config';

export type QuickHighlighterStyle = {
  // What the rows style: the selected highlights, or the next stroke of the armed tile.
  subject: { kind: 'strokes'; ids: string[]; name: string } | { kind: 'tool'; name: string };
  colour: { value: string | null; options: { value: string; name: string; swatch: string }[] };
  width: { value: HighlighterWidthId | null };
};

// An unlocked highlight stroke: the only element the Highlighter rows style.
export function isHighlightStroke(el: Element): el is FreehandElement {
  return el.type === 'freehand' && el.pen === 'highlighter' && el.locked !== true;
}

const OPTIONS = HIGHLIGHTER_COLORS.map((c) => ({ value: c.id, name: c.label, swatch: c.id }));

// A colour marks a swatch only when it is one of the five (case aside); anything else marks none.
const colourValue = (hex: string | undefined): string | null => {
  const lower = hex?.toLowerCase();
  return OPTIONS.some((o) => o.value === lower) ? lower! : null;
};

const shared = <T>(values: T[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null;

export function strokesHighlighterStyle(
  selected: readonly Element[],
): QuickHighlighterStyle | undefined {
  const strokes = selected.filter(isHighlightStroke);
  if (strokes.length === 0) return undefined;
  return {
    subject: {
      kind: 'strokes',
      ids: strokes.map((s) => s.id),
      name: strokes.length === 1 ? 'Highlight' : `${strokes.length} highlights`,
    },
    colour: { value: shared(strokes.map((s) => colourValue(s.strokeColor))), options: OPTIONS },
    width: {
      value: shared(strokes.map((s) => highlighterWidthId(s.penWidth ?? HIGHLIGHTER_WIDTH))),
    },
  };
}

export function toolHighlighterStyle(colour: string, width: number): QuickHighlighterStyle {
  return {
    subject: { kind: 'tool', name: 'Highlighter' },
    colour: { value: colourValue(colour), options: OPTIONS },
    width: { value: highlighterWidthId(width) },
  };
}

/** A highlight restyled. Medium clears `penWidth`, the renderers' default. */
export function applyHighlighterStyle(
  el: Element,
  patch: { colour?: string; width?: HighlighterWidthId },
): Element {
  if (!isHighlightStroke(el)) return el;
  let next: FreehandElement = el;
  if (patch.colour !== undefined) next = { ...next, strokeColor: patch.colour };
  if (patch.width !== undefined) {
    const px = highlighterWidthPx(patch.width);
    const { penWidth: _dropped, ...rest } = next;
    next = px === HIGHLIGHTER_WIDTH ? rest : { ...rest, penWidth: px };
  }
  return next;
}
