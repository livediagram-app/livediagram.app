// A text box that fits or wraps hugs its text (docs/specs/023-draw-mode/draw-mode.md "Text boxes",
// docs/specs/007-editor/editor-modes.md "A text box's sizing"), in either editor mode:
// the box is the text's own line box plus a little padding, never a default size. This module
// is the pure geometry: what the box is for a measured block of text, where a click or a drag
// puts a new one, and what a resize handle does to it. The measuring itself is the DOM's
// (text-hug-measure.ts), handed in as a function, so the numbers here are exact to the font.

import {
  LABEL_FONT_PX,
  PADDING_PX,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  type Element,
  type TextElement,
} from '@livediagram/document';
import type { DragMode, ShapeBounds } from '@/lib/canvas';

// Canvas px around the text's line box, left and right, then top and bottom.
export const TEXT_HUG_PAD_X = 4;
export const TEXT_HUG_PAD_Y = 2;
// A click-placed box widens with its text up to this, then wraps.
export const TEXT_HUG_MAX_WIDTH = 480;
// The single-line label's leading (`leading-tight`), shared by display, editor and measurer.
export const TEXT_HUG_LEADING = 1.25;

export type BlockSize = { width: number; height: number };

// Measures the text block at a width: `fixed` lays it out at exactly `width`; otherwise it takes
// its natural width, capped at `width`. Returns the block's own size, padding excluded.
export type MeasureTextBlock = (width: number, fixed: boolean) => BlockSize;

// Whether this element hugs its text: a text box whose sizing fits or wraps. Read off the element,
// never the editor mode, so every viewer draws the same box.
export function hugsText(el: Element): el is TextElement {
  return el.type === 'text' && el.sizing !== undefined;
}

// The padding around the text: the element's own preset when it has one, else the hug padding.
export function textHugPadding(el: TextElement): { x: number; y: number } {
  if (el.padding) {
    const px = PADDING_PX[el.padding];
    return { x: px, y: px };
  }
  return { x: TEXT_HUG_PAD_X, y: TEXT_HUG_PAD_Y };
}

// CSS padding for the label and its editor.
export function textHugPaddingCss(el: TextElement): string {
  const pad = textHugPadding(el);
  return `${pad.y}px ${pad.x}px`;
}

// The label px a hugging text box draws at: its size preset (a hugging box draws 'scale' at the
// preset's fixed px rather than fitting it to the box) times its Shift-resize scale.
export function textHugFontPx(el: TextElement): number {
  return LABEL_FONT_PX[el.textSize ?? 'scale'] * (el.textScale ?? 1);
}

// The box that hugs the measured text. A 'fit' box takes the text's width (up to the wrap
// width); a set-width box keeps its width. The height always hugs. Whole px, rounded up, so the
// text never wraps a word early.
export function hugTextSize(el: TextElement, measure: MeasureTextBlock): BlockSize {
  const pad = textHugPadding(el);
  if (el.sizing === 'fit') {
    const block = measure(TEXT_HUG_MAX_WIDTH - 2 * pad.x, false);
    return {
      width: Math.ceil(block.width) + 2 * pad.x,
      height: Math.ceil(block.height) + 2 * pad.y,
    };
  }
  const block = measure(Math.max(1, el.width - 2 * pad.x), true);
  return { width: el.width, height: Math.ceil(block.height) + 2 * pad.y };
}

// A text box whose edit just committed (its label already set): removed when left empty (null),
// else sized to hug the committed text. The size lands with the label, as one step.
export function hugCommittedText(
  el: TextElement,
  measure: (el: TextElement) => MeasureTextBlock,
): TextElement | null {
  if ((el.label ?? '').trim() === '') return null;
  return { ...el, ...hugTextSize(el, measure(el)) };
}

// A new Draw mode text box, empty and about to be typed into. A click puts the caret at the
// click (the box's left edge a padding to its left, its one line centred on it) and the box
// widens with the text. A drag sets the width from the dragged box; the height is one line.
export function placedTextBox(
  el: TextElement,
  tap: boolean,
  start: { x: number; y: number },
  drag: ShapeBounds,
): Pick<TextElement, 'x' | 'y' | 'width' | 'height' | 'label' | 'sizing'> {
  const pad = textHugPadding(el);
  const height = Math.ceil(textHugFontPx(el) * TEXT_HUG_LEADING) + 2 * pad.y;
  if (tap) {
    return {
      label: '',
      sizing: 'fit',
      x: start.x - pad.x,
      y: start.y - height / 2,
      width: 2 * pad.x,
      height,
    };
  }
  return { label: '', sizing: 'wrap', x: drag.x, y: drag.y, width: drag.width, height };
}

// One frame of a handle resize on a hugging text box. `next` is the frame's resolved bounds
// (snapped, and ratio-kept under Shift); `current` is the element as the previous frame left it.
//
// - A plain resize from a side sets the width (so the box wraps); the text rewraps and the height
//   hugs.
//   The top and bottom handles set nothing: the height is the text's.
// - Shift keeps the ratio by scaling the text with the box: the scale follows the text area's
//   width, and the height hugs the scaled text.
//
// The edge a handle does not move stays put: the bottom for a top handle, else the top; under
// Shift a side handle scales about the middle, as the ratio rule does.
export function hugResizedText(
  current: TextElement,
  next: ShapeBounds,
  mode: Exclude<DragMode, 'move'>,
  constrain: boolean,
  measure: (el: TextElement) => MeasureTextBlock,
): TextElement {
  const pad = textHugPadding(current);
  const handle = mode.slice('resize-'.length);
  const fromTop = handle.includes('n');
  if (constrain) {
    const was = Math.max(1, current.width - 2 * pad.x);
    const now = Math.max(1, next.width - 2 * pad.x);
    const scale = (current.textScale ?? 1) * (now / was);
    const textScale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, scale));
    const scaled = { ...current, textScale };
    const height = Math.ceil(measure(scaled)(now, true).height) + 2 * pad.y;
    const y = fromTop
      ? next.y + next.height - height
      : handle.includes('s')
        ? next.y
        : next.y + (next.height - height) / 2;
    return { ...scaled, x: next.x, y, width: next.width, height };
  }
  let sized = current;
  if (handle.includes('e') || handle.includes('w')) {
    sized = { ...current, sizing: 'wrap', x: next.x, width: next.width };
  }
  const { height } = hugTextSize(sized, measure(sized));
  return { ...sized, y: fromTop ? current.y + current.height - height : current.y, height };
}
