// The multiplier on a label's size (docs/specs/007-editor/pages-mode.md "Sizes"): a Shift-resized
// text box, and a text or shape a page re-fit scaled with its page, store `textScale`. Every label
// renderer (the canvas, the exports, the thumbnails, the lint) reads it here, so they agree.
import type { Element, TextSize } from './index';

type Scaled = { type: Element['type']; textScale?: number };

/** The scale an element's label draws at: its `textScale` on a text or a shape, else 1. */
export function labelTextScale(el: Scaled): number {
  return el.type === 'text' || el.type === 'shape' ? (el.textScale ?? 1) : 1;
}

/**
 * The element with a picked text size (docs/specs/004-interface-design/fonts.md "Text size"): the
 * size is the size the words draw at, so any scale goes with it.
 */
export function withPickedTextSize<E extends Element>(el: E, size: TextSize): E {
  if (!('textScale' in el)) return { ...el, textSize: size };
  const { textScale: _scale, ...rest } = el as E & { textScale?: number };
  void _scale;
  return { ...rest, textSize: size } as E;
}
