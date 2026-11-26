// A layout's boxes, softened (docs/specs/007-editor/pages-mode.md "Layouts", "Soft boxes"): every box a layout
// draws is bound to the theme's Soft colour preset (a pale tint of the accent, a lighter accent border, the thin
// border, words held to the text floor) and given the thin border, so it reads as a light panel rather than a solid
// block. The panel stays solid: nothing behind it (a page design's blocks or stripes) ever shows through. The layout
// writes no colours of its own; placing it fills them from the tab's theme (themedForTab), and a theme picked later
// re-derives them. A box that says something by its colour, its border, its opacity, an icon or a picture is left
// as it is. Pure: elements in, elements out.
import type { Element, ShapeElement } from '@livedocuments/document';

// The colour preset a soft box is bound to (docs/specs/010-palette/style-presets.md).
export const SOFT_BOX_PRESET = 'soft';
// A box this small, as a share of the page's short side, is a mark (a dot, a swatch, a tick box), not a panel.
const SOFT_BOX_MIN_SHARE = 0.05;

function isSoftBox(el: Element, min: number): el is ShapeElement {
  if (el.type !== 'shape' || el.shape !== 'square') return false;
  if (Math.min(el.width, el.height) < min) return false;
  // Colour, a border, an icon or a picture of its own carries meaning; so does an opacity already chosen.
  return !(
    el.fillColor ||
    el.strokeColor ||
    el.textColor ||
    el.penColour ||
    el.colorPreset ||
    el.strokeWidth ||
    el.iconId ||
    el.imageId ||
    el.opacity !== undefined ||
    el.themeLockFill
  );
}

/** The layout's boxes softened for a page whose short side is `shortSide` (canvas px). */
export function softenLayoutBoxes(els: readonly Element[], shortSide: number): Element[] {
  const min = shortSide * SOFT_BOX_MIN_SHARE;
  return els.map((el) =>
    isSoftBox(el, min) ? { ...el, colorPreset: SOFT_BOX_PRESET, strokeWidth: 'thin' as const } : el,
  );
}
