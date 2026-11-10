// The multiplier on a label's size (docs/specs/007-editor/pages-mode.md "Sizes"): a Shift-resized
// text box, and a text or shape a page re-fit scaled with its page, store `textScale`. Every label
// renderer (the canvas, the exports, the thumbnails, the lint) reads it here, so they agree.
import { labelFontPx, TEXT_PX_MAX, TEXT_PX_MIN } from '@liveworkspace/model-core/label-font';
import { splitTextPx } from '@liveworkspace/element-model/text-presets';
import type { Element, TextSize } from './index';

type Scaled = { type: Element['type']; textScale?: number };

/** The scale an element's label draws at: its `textScale` on a text or a shape, else 1. */
export function labelTextScale(el: Scaled): number {
  return el.type === 'text' || el.type === 'shape' ? (el.textScale ?? 1) : 1;
}

// A document's Size slider (docs/specs/004-interface-design/fonts.md "Text size", "In livedocuments"): a page's
// words run bigger than a diagram's, so a text's or a shape's slider runs 24 to 72 px. The model's own range
// (TEXT_PX_MIN to TEXT_PX_MAX, shared by every product) is unchanged: a size above its 48 is stored as 48 with the rest
// as `textScale`, as a layout's headline and an imported slide's are, so every renderer draws it as it is.
export const DOCUMENT_TEXT_PX_MIN = 24;
export const DOCUMENT_TEXT_PX_MAX = 72;

export type TextPxRange = { min: number; max: number };

/** The Size slider's range for an element's label: a document's for a text or a shape (the two that can carry a
 *  scale past 48), the model's for the rest (a note, an arrow's caption, a table's cells, a chart's key). */
export function textPxRangeFor(type: string): TextPxRange {
  return type === 'text' || type === 'shape'
    ? { min: DOCUMENT_TEXT_PX_MIN, max: DOCUMENT_TEXT_PX_MAX }
    : { min: TEXT_PX_MIN, max: TEXT_PX_MAX };
}

// A px as a text or a shape stores it (whole px up to the model's most, the rest as `textScale`): the text styles'
// rule, shared with every product that offers them.
export { splitTextPx };

/** The size an element's words draw at, for its Size slider: its stored size times its scale, as a px where there
 *  is a scale; else the size as stored. A stored size is never rewritten to fit the slider. */
export function drawnTextSize(el: Scaled & { textSize?: TextSize }, fallback: TextSize): TextSize {
  const size = el.textSize ?? fallback;
  const scale = labelTextScale(el);
  if (scale === 1 || size === 'scale') return size;
  return Math.round(labelFontPx(size) * scale);
}

/** A size's stored fields on a new element of this type (the tab's size for new text seeding it): past 48 px, a
 *  text or a shape takes the rest as its scale. */
export function textSizeFields(
  type: string,
  size: TextSize,
): { textSize: TextSize; textScale?: number } {
  const scales = type === 'text' || type === 'shape';
  return scales && typeof size === 'number' && size > TEXT_PX_MAX
    ? splitTextPx(size)
    : { textSize: size };
}

/**
 * The element with a picked text size (docs/specs/004-interface-design/fonts.md "Text size"): the
 * size is the size the words draw at, so any scale goes with it. A text or a shape picked past the model's 48 px
 * takes the rest as its scale.
 */
export function withPickedTextSize<E extends Element>(el: E, size: TextSize): E {
  const fields = textSizeFields(el.type, size);
  if (fields.textScale !== undefined) return { ...el, ...fields };
  if (!('textScale' in el)) return { ...el, textSize: size };
  const { textScale: _scale, ...rest } = el as E & { textScale?: number };
  void _scale;
  return { ...rest, textSize: size } as E;
}
