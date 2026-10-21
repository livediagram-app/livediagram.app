// The element menu's colour rows and Ink (docs/specs/007-editor/editor-modes.md "One look"): Ink is
// offered after the theme's colours wherever the element stores a stock colour by name, and a
// stored name shows in its version for the canvas.
import {
  PEN_INK,
  resolveStockColours,
  type CanvasSurface,
  type Element,
} from '@livediagram/document';

export type InkRole = 'line' | 'text';

const NAMED: Record<InkRole, ReadonlySet<Element['type']>> = {
  line: new Set(['shape', 'arrow', 'freehand']),
  text: new Set(['shape', 'text', 'sticky', 'arrow']),
};

/** The Ink swatch's colour for a row, or undefined where the element cannot store Ink. */
export function inkSwatch(el: Element, role: InkRole, surface: CanvasSurface): string | undefined {
  return NAMED[role].has(el.type) ? PEN_INK[surface] : undefined;
}

/** The colour a row shows: the element's own, a stored name's version, else the fallback. */
export function shownColour(
  el: Element,
  role: InkRole,
  surface: CanvasSurface,
  fallback: string,
): string {
  const shown = resolveStockColours(el, surface) as { strokeColor?: string; textColor?: string };
  return (role === 'line' ? shown.strokeColor : shown.textColor) ?? fallback;
}
