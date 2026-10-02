// draw.io font sizes (px) to livediagram's text presets
// (docs/specs/020-import-export/blueprints/drawio-import.md "Text size"): a whole element's
// `fontSize`, and a span's size inside an HTML label. Every size the importer sets comes from here,
// so how text smaller than livediagram's smallest size maps is decided in one function.

import {
  LABEL_FONT_PX,
  NOTE_FONT_PX,
  arrowLabelFontSize,
  type RunSize,
  type TextSize,
} from '@livediagram/document';
import { nearest } from './nearest';

/** The scale an element's text sizes on: a shape's label, a sticky note's, an arrow's. */
export type TextScale = 'label' | 'note' | 'arrow';

// The fixed presets (a run has no 'scale'), smallest first.
const SIZES: readonly RunSize[] = ['sm', 'md', 'lg'];
const ARROW_PX = {
  sm: arrowLabelFontSize('sm'),
  md: arrowLabelFontSize('md'),
  lg: arrowLabelFontSize('lg'),
};
const tableOf = (scale: TextScale) =>
  (scale === 'note' ? NOTE_FONT_PX : scale === 'arrow' ? ARROW_PX : LABEL_FONT_PX) as Record<
    RunSize,
    number
  >;

/** An element's draw.io font size as the preset nearest on its own scale (D26). */
export function elementTextSize(px: number, scale: TextScale): TextSize {
  return nearest(tableOf(scale), SIZES, px);
}

/**
 * A span's size inside a label whose own size is `elementPx`: the preset nearest the span's px, or
 * undefined when that is the label's own preset (the run inherits it). A span smaller than the
 * smallest preset lands on the smallest; this is where a smaller run size, or a report rule, would
 * go (spec "Text size").
 */
export function runTextSize(px: number, elementPx: number, scale: TextScale): RunSize | undefined {
  const size = nearest(tableOf(scale), SIZES, px);
  return size === elementTextSize(elementPx, scale) ? undefined : size;
}

// The HTML `<font size>` scale (1 to 7) in px, as browsers draw it.
const HTML_FONT_PX = [10, 13, 16, 18, 24, 32, 48];

/** An HTML `<font size="n">` in px; undefined outside 1 to 7. */
export function htmlFontSizePx(n: number): number | undefined {
  return Number.isInteger(n) && n >= 1 && n <= 7 ? HTML_FONT_PX[n - 1] : undefined;
}
