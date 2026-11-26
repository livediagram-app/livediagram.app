// A layout's boxes, softened (docs/specs/007-editor/pages-mode.md "Layouts", "Soft boxes"): every box a layout
// draws wears a fine border rather than the default medium one, and a card with no words of its own (its words are
// text set over it) is drawn a little see-through, so the page and its design show through and the box reads as
// a light panel rather than a solid block. Words never fade: a box with a label of its own keeps full opacity, and
// text over a card is its own element. A box that says something by its colour, its border or its opacity is left
// as it is. Pure: elements in, elements out.
import type { Element, ShapeElement } from '@livedocuments/document';

// How opaque a word-less card is drawn: light enough for the page to show through, solid enough to hold its
// panel shape on white paper and on a dark page alike (Work Tracker 1481, tuned on the Default, Ocean and Midnight
// themes over plain, gradient and designed pages).
export const SOFT_CARD_OPACITY = 0.75;
// A box this small, as a share of the page's short side, is a mark (a dot, a swatch, a tick box), not a panel.
const SOFT_BOX_MIN_SHARE = 0.05;

function isSoftBox(el: Element, min: number): el is ShapeElement {
  if (el.type !== 'shape' || el.shape !== 'square') return false;
  if (Math.min(el.width, el.height) < min) return false;
  // Colour, an icon or a picture of its own carries meaning; so does an opacity already chosen.
  return !(
    el.fillColor ||
    el.strokeColor ||
    el.penColour ||
    el.iconId ||
    el.imageId ||
    el.opacity !== undefined ||
    el.themeLockFill
  );
}

/** The layout's boxes softened for a page whose short side is `shortSide` (canvas px). */
export function softenLayoutBoxes(els: readonly Element[], shortSide: number): Element[] {
  const min = shortSide * SOFT_BOX_MIN_SHARE;
  return els.map((el) => {
    if (!isSoftBox(el, min)) return el;
    // A border the layout chose (a recommended option's thick one, a frame's none) is kept.
    const border = el.strokeWidth === undefined ? { strokeWidth: 'thin' as const } : {};
    return el.label ? { ...el, ...border } : { ...el, ...border, opacity: SOFT_CARD_OPACITY };
  });
}
