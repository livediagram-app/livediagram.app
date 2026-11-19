// What a hugging text box's measurer (text-hug-measure.ts) and each editor's text box geometry (its lib/text-hug.ts)
// both read: the leading the text is laid out at, the px it is drawn at, and the shape of a measure.

import { labelFontPx } from '@liveworkspace/model-core/label-font';
import type { TextElement } from '@liveworkspace/element-model/element';

// The single-line label's leading (`leading-tight`), shared by display, editor and measurer.
export const TEXT_HUG_LEADING = 1.25;

export type BlockSize = { width: number; height: number };

// Measures the text block at a width: `fixed` lays it out at exactly `width`; otherwise it takes
// its natural width, capped at `width`. Returns the block's own size, padding excluded.
export type MeasureTextBlock = (width: number, fixed: boolean) => BlockSize;

// The label px a hugging text box draws at: its size preset (a hugging box draws 'scale' at the
// preset's fixed px rather than fitting it to the box) times its Shift-resize scale.
export function textHugFontPx(el: Pick<TextElement, 'textSize' | 'textScale'>): number {
  return labelFontPx(el.textSize ?? 'scale') * (el.textScale ?? 1);
}
