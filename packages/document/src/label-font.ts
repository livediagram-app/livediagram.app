// Label font sizes (docs/specs/004-interface-design/fonts.md), in ONE place.
//
// The canvas and the exporters each had their own table, and they disagreed:
// the default `md` drew at 22px on the canvas and 14px in an export, so every
// export came out with labels two thirds the size they were
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

import type { TextSize, TextSizePreset } from './index';
import type { RunSize } from './rich-text';

/**
 * The Size slider's range (docs/specs/004-interface-design/fonts.md "Text size"): an exact
 * size is a whole px from 6 to 48. 6 is the smallest that still reads at 100% zoom; 48 is a
 * headline, past every preset (a label's Large is 32), so any older size has a place on it.
 */
export const TEXT_PX_MIN = 6;
export const TEXT_PX_MAX = 48;

/** Whether a size is an exact px from the slider rather than a named preset. */
export function isTextPx(size: TextSize | undefined): size is number {
  return typeof size === 'number';
}

/** A slider value made safe to store: a whole px clamped to the slider's range. */
export function clampTextPx(px: number): number {
  if (!Number.isFinite(px)) return TEXT_PX_MIN;
  return Math.min(TEXT_PX_MAX, Math.max(TEXT_PX_MIN, Math.round(px)));
}

/** Whether a stored value is a size this model accepts: a preset or a slider px. */
export function isTextSize(v: unknown): v is TextSize {
  if (typeof v === 'number') return Number.isInteger(v) && v >= TEXT_PX_MIN && v <= TEXT_PX_MAX;
  return v === 'scale' || v === 'sm' || v === 'md' || v === 'lg';
}

/** A stored size made safe to draw: a px clamped to the slider's range, a known preset as itself, and anything
 *  else (an imported or hand-written value the structural validator does not check) as the default, `md`.
 *  Every reader goes through it, so a stray `textSize: 1000` never draws 1000px text and an unknown preset
 *  never draws at an undefined size. */
export function readTextSize(textSize: TextSize | undefined): TextSize {
  if (typeof textSize === 'number') return clampTextPx(textSize);
  return textSize === 'scale' || textSize === 'sm' || textSize === 'lg' ? textSize : 'md';
}

/** A shape / text element's label. */
export const LABEL_FONT_PX: Record<TextSizePreset, number> = {
  sm: 14,
  md: 22,
  lg: 32,
  // A single-line 'scale' is not fitted: it is a middling fixed size, since
  // only a note measures its text against its box.
  scale: 16,
};

/** A sticky note's label, which runs smaller at every preset. */
export const NOTE_FONT_PX: Record<TextSizePreset, number> = {
  sm: 12,
  md: 16,
  lg: 22,
  // On a note 'scale' means FILL THE NOTE, measured against the box by the
  // caller (fitMultilineFontPx). This is the base used when nothing has
  // measured it.
  scale: 14,
};

/**
 * An extra-small run (docs/specs/008-canvas/canvas-and-palette.md "Extra-small runs"): 10 px on every
 * label scale, one step below the smallest preset (14 px single-line, 12 px multi-line, 11 px in a
 * note). The operator's choice for imported text that reads smaller than any preset, such as a
 * draw.io subtitle at 8 px; it keeps the label's own colour, so its contrast is the label's.
 * Safe range: 9 to 11, and always below every scale's `sm`.
 */
export const RUN_XS_PX = 10;

/** The px a run's own size draws at, on the single-line or the multi-line scale. */
export function runFontPx(size: RunSize, multiline = false): number {
  if (size === 'xs') return RUN_XS_PX;
  return (multiline ? NOTE_FONT_PX : LABEL_FONT_PX)[size];
}

/**
 * The px a label renders at.
 *
 * `multiline` is the sticky note: the one element type whose label is a block
 * of writing rather than a name. Absent `textSize` means the default preset,
 * which is `md`. An exact px size draws at that px on either scale.
 */
export function labelFontPx(stored: TextSize | undefined, multiline = false): number {
  const textSize = readTextSize(stored);
  // An exact size is the same px on every scale: what the slider says is what draws.
  if (isTextPx(textSize)) return textSize;
  const table = multiline ? NOTE_FONT_PX : LABEL_FONT_PX;
  return table[textSize];
}

/**
 * A legend's rows: a chart's key strip and the standalone Legend card
 * (docs/specs/009-elements/pie-chart.md). One scale for both, so a Legend dropped beside a chart reads at
 * the same size as the chart's own key.
 *
 * Its own table because a key is not a name: at the label scale a Medium
 * legend would be 22px rows in a 72px strip. It was a fixed 11px on a chart
 * (13px on the card) with no control at all, which read as too small.
 * 'scale' has nothing to fit here, so it draws at the default.
 */
export const LEGEND_FONT_PX: Record<TextSizePreset, number> = {
  sm: 11,
  md: 14,
  lg: 18,
  scale: 14,
};

/** The px a legend row renders at. Absent `textSize` means `md`. */
export function legendFontPx(stored: TextSize | undefined): number {
  const textSize = readTextSize(stored);
  if (isTextPx(textSize)) return textSize;
  return LEGEND_FONT_PX[textSize];
}
