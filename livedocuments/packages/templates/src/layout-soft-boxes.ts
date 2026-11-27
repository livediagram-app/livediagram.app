// A layout's boxes, softened (docs/specs/007-editor/pages-mode.md "Layouts", "Soft boxes"): every box a layout
// draws is bound to the theme's Soft colour preset (a pale tint of the accent, a lighter accent border, the thin
// border, words held to the text floor), given the thin border and drawn part see-through (SOFT_BOX_OPACITY, Work
// Tracker 1501), so it reads as a light panel that takes on the design it sits on rather than a solid block. The
// layout writes no colours of its own; placing it fills them from the tab's theme (themedForTab), and a theme picked
// later re-derives them. A box that says something by its colour, its border, its opacity, an icon or a picture is
// left as it is. Pure: elements in, elements out.
import type { Element, ShapeElement } from '@livedocuments/document';

// The colour preset a soft box is bound to (docs/specs/010-palette/style-presets.md).
export const SOFT_BOX_PRESET = 'soft';
// How see-through a soft box is drawn (owner, Work Tracker 1501: "around 50 to 60%"): the top of that range, so
// the panel still reads as one on a busy page design while the design shows through. The box holds no words of its
// own (a layout's words sit on it as text elements, drawn solid), so nothing written fades with it.
export const SOFT_BOX_OPACITY = 0.6;
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
    isSoftBox(el, min)
      ? {
          ...el,
          colorPreset: SOFT_BOX_PRESET,
          strokeWidth: 'thin' as const,
          // Translucent only while it holds no words: a label of its own would fade with it.
          ...(el.label?.trim() || el.richText ? {} : { opacity: SOFT_BOX_OPACITY }),
        }
      : el,
  );
}

/** A soft box made solid again when what it now carries (a person's icon or sticker, carried into the layout by
 *  carryPageContent) would fade with it; anything else as it is. */
export function solidWhenCarrying(el: ShapeElement): ShapeElement {
  if (el.colorPreset !== SOFT_BOX_PRESET || el.opacity !== SOFT_BOX_OPACITY) return el;
  if (!el.iconId && !el.stickerId && !el.label?.trim() && !el.richText) return el;
  const { opacity: _see, ...solid } = el;
  return solid;
}
