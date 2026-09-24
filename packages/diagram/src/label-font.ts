// Label font sizes (spec/28), in ONE place.
//
// The canvas and the exporters each had their own table, and they disagreed:
// the default `md` drew at 22px on the board and 14px in an export, so every
// diagram came out of an export with labels two thirds the size they were
// drawn at. That is not a rounding difference, it is a different picture, and
// it was invisible to every test because each renderer was consistent with
// itself.
//
// Two scales, because there are two kinds of label:
//
//  - SINGLE-LINE, what a shape / text element wears: sized to be read as the
//    thing's name, so it grows generously with the preset.
//  - MULTI-LINE, what a sticky note wears: sized to fit a few lines of
//    writing, so it runs smaller at every preset.

import type { TextSize } from './index';

/** A shape / text element's label. */
export const LABEL_FONT_PX: Record<TextSize, number> = {
  sm: 14,
  md: 22,
  lg: 32,
  // A single-line 'scale' is not fitted: it is a middling fixed size, since
  // only a note measures its text against its box.
  scale: 16,
};

/** A sticky note's label, which runs smaller at every preset. */
export const NOTE_FONT_PX: Record<TextSize, number> = {
  sm: 12,
  md: 16,
  lg: 22,
  // On a note 'scale' means FILL THE NOTE, measured against the box by the
  // caller (fitMultilineFontPx). This is the base used when nothing has
  // measured it.
  scale: 14,
};

/**
 * The px a label renders at.
 *
 * `multiline` is the sticky note: the one element type whose label is a block
 * of writing rather than a name. Absent `textSize` means the default preset,
 * which is `md`.
 */
export function labelFontPx(textSize: TextSize | undefined, multiline = false): number {
  const table = multiline ? NOTE_FONT_PX : LABEL_FONT_PX;
  return table[textSize ?? 'md'];
}
