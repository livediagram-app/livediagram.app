// draw.io font sizes (px) to livediagram's text presets
// (docs/specs/020-import-export/blueprints/drawio-import.md "Text size"): a whole element's
// `fontSize`, and a span's size inside an HTML label. Every size the importer sets comes from here:
// text under 12 px takes the extra-small run size (`xs`, RUN_XS_PX), and text under what `xs`
// shows is counted (spec "Text size"; docs/specs/008-canvas/canvas-and-palette.md "Extra-small runs").

import {
  LABEL_FONT_PX,
  NOTE_FONT_PX,
  RUN_XS_PX,
  arrowLabelFontSize,
  type RunSize,
  type TextSize,
} from '@livediagram/document';
import { nearest } from './nearest';

/** The scale an element's text sizes on: a shape's label, a sticky note's, an arrow's. */
export type TextScale = 'label' | 'note' | 'arrow';

/**
 * Text under this many px reads extra-small: closer to `xs` (10 px) than to `sm` (14 px on a label,
 * 12 px on a note), and draw.io's own default body text (12 px) stays `sm`. Safe range: 11 to 12.
 */
export const DRAWIO_XS_BELOW_PX = 12;

// The element presets, smallest first ('xs' is a run size only, and an element has 'scale' too).
type Preset = Exclude<RunSize, 'xs'>;
const SIZES: readonly Preset[] = ['sm', 'md', 'lg'];
const ARROW_PX = {
  sm: arrowLabelFontSize('sm'),
  md: arrowLabelFontSize('md'),
  lg: arrowLabelFontSize('lg'),
};
const tableOf = (scale: TextScale) =>
  (scale === 'note' ? NOTE_FONT_PX : scale === 'arrow' ? ARROW_PX : LABEL_FONT_PX) as Record<
    Preset,
    number
  >;

/** An element's draw.io font size as the preset nearest on its own scale (D26). */
export function elementTextSize(px: number, scale: TextScale): TextSize {
  return nearest(tableOf(scale), SIZES, px);
}

/** Whether a label of this size reads extra-small; never on an arrow, whose caption has no runs. */
export function labelIsExtraSmall(px: number, scale: TextScale): boolean {
  return scale !== 'arrow' && px < DRAWIO_XS_BELOW_PX;
}

/** Whether text is smaller than `xs` can show: it comes in at `xs` and is counted. */
export function belowExtraSmall(px: number): boolean {
  return px < RUN_XS_PX;
}

/**
 * A span's size inside a label whose own size is `elementPx`: `xs` under 12 px, else the preset
 * nearest the span's px; undefined when that is the label's own size (the run inherits it). A label
 * that is itself extra-small has `xs` as its own size, so a larger span inside it keeps its preset.
 */
export function runTextSize(px: number, elementPx: number, scale: TextScale): RunSize | undefined {
  if (scale === 'arrow') return undefined;
  const size: RunSize = labelIsExtraSmall(px, scale) ? 'xs' : nearest(tableOf(scale), SIZES, px);
  const own: RunSize = labelIsExtraSmall(elementPx, scale)
    ? 'xs'
    : nearest(tableOf(scale), SIZES, elementPx);
  return size === own ? undefined : size;
}

// The HTML `<font size>` scale (1 to 7) in px, as browsers draw it.
const HTML_FONT_PX = [10, 13, 16, 18, 24, 32, 48];

/** An HTML `<font size="n">` in px; undefined outside 1 to 7. */
export function htmlFontSizePx(n: number): number | undefined {
  return Number.isInteger(n) && n >= 1 && n <= 7 ? HTML_FONT_PX[n - 1] : undefined;
}

/**
 * Mean advance per em of a reference text (`The quick brown fox jumps over the lazy dog 0123456789`)
 * in the canvas label face (the system UI stack at weight 500), measured in Chromium on Linux. The
 * importer measures text with it rather than in the browser, so an import is the same everywhere.
 * Safe range: 0.45 to 0.52.
 */
export const LABEL_EM_ADVANCE = 0.4785;
/** The same for draw.io's Helvetica (Arial and Liberation Sans are metric-compatible) at 400. */
export const HELVETICA_EM_ADVANCE = 0.4746;
/** The canvas label's line height, as a multiple of its size (17.5 px at 14 px). */
export const LABEL_LINE_HEIGHT = 1.25;
/** draw.io's label line height (`mxConstants.LINE_HEIGHT`). */
export const DRAWIO_LINE_HEIGHT = 1.2;

/** About how wide `chars` characters set in the canvas label face at `px`. */
export const labelTextWidth = (chars: number, px: number): number => chars * LABEL_EM_ADVANCE * px;
