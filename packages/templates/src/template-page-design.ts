// The designed-page parts the Illustrate templates share (docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): the poster, the year in review, the résumé and the recipe card are
// finished deliverables in their own colours rather than theme-painted layouts, so they build
// from the same few pieces: a locked fill, a plain panel, a tinted glyph, a glyph on a disc and a
// soft card shadow. Every fill that carries a design sets `themeLockFill`, so a theme switch
// cannot flatten it into the theme's single element fill.
import type { Element, ElementShadow, ShapeElement } from '@livediagram/document';
import type { Kit } from './page-layout-kit';

/** A fill that carries the design, locked against the theme; the stroke defaults to the fill. */
export function lockedFill(fill: string, stroke: string = fill): Partial<ShapeElement> {
  return { fillColor: fill, strokeColor: stroke, themeLockFill: true };
}

/** The soft lift a card on a page wears. */
export const CARD_SHADOW: ElementShadow = { offsetX: 0, offsetY: 6, blur: 18, opacity: 0.12 };

/** A plain rounded panel in a locked colour, with no label. */
export function panel(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  extra: Partial<ShapeElement> = {},
): ShapeElement {
  return k.shape('square', x, y, w, h, {
    label: '',
    borderRadius: 'lg',
    ...lockedFill(fill),
    ...extra,
  });
}

/** A line glyph from the icon catalogue, inked `color`. */
export function glyph(
  k: Kit,
  iconId: string,
  x: number,
  y: number,
  size: number,
  color: string,
): ShapeElement {
  return k.shape('icon', x, y, size, size, { label: '', iconId, strokeColor: color });
}

/** A glyph centred on a locked disc of diameter `d`. */
export function iconDisc(
  k: Kit,
  iconId: string,
  x: number,
  y: number,
  d: number,
  disc: string,
  ink: string,
): Element[] {
  const inset = d * 0.24;
  return [
    k.shape('circle', x, y, d, d, { label: '', ...lockedFill(disc) }),
    glyph(k, iconId, x + inset, y + inset, d - inset * 2, ink),
  ];
}
