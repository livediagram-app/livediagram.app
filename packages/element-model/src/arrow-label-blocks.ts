// Arrow label blocks (docs/specs/008-canvas/arrow-labels.md "Width and wrapping"): measuring words (cached),
// the width cap a line's direction allows, a wrapped text block and its padded plate, how much route a block
// covers, and the widest block that fits a run. Re-exported from arrow-label-layout.ts.

import {
  longestWordWidth,
  wrapBalanced,
  type TextMeasure,
} from '@liveworkspace/model-core/arrow-label-wrap';
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { ArrowElement } from './element';
import { labelMeasure } from './svg-render-primitives';
import type { Pt } from './arrow-label-route';

export const LABEL_PAD_X_PX = 4;
export const LABEL_PAD_Y_PX = 2;
export const KNOCKOUT_MARGIN_PX = 3;

const CHAR_WIDTH_FALLBACK_PX = 7;
const WORD_WIDTH_CACHE_MAX = 2000;

export type ArrowLabelMeasureFor = (
  fontPx: number,
  bold: boolean,
  italic: boolean,
  family?: string,
) => TextMeasure;

export type ArrowLabelLayoutOptions = {
  crossCapPx: number;
  alongCapPx: number;
  fontFamilyOf?: (arrow: ArrowElement) => string | undefined;
  measureFor?: ArrowLabelMeasureFor;
  // Which fonts had loaded when measuring (bump it when webfonts land). Part of the word-width cache key,
  // so text first measured in a fallback face is measured again in the real one.
  fontEpoch?: number;
};

export type Block = { lines: string[]; width: number; height: number };

// ---------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------

const wordWidths = new Map<string, number>();

export function cachedMeasure(key: string, measure: TextMeasure, fontPx: number): TextMeasure {
  return (s) => {
    const k = `${key}|${s}`;
    const hit = wordWidths.get(k);
    if (hit !== undefined) return hit;
    let w = measure(s);
    if (!Number.isFinite(w)) w = s.length * CHAR_WIDTH_FALLBACK_PX * (fontPx / 12);
    if (wordWidths.size >= WORD_WIDTH_CACHE_MAX) wordWidths.clear();
    wordWidths.set(k, w);
    return w;
  };
}

// labelMeasure shares one canvas context, so the font is set on every call
// rather than once: two captions measured in turn must not borrow each
// other's font.
export const defaultMeasureFor: ArrowLabelMeasureFor = (px, bold, italic, family) => (s) =>
  labelMeasure(px, bold, italic, family)(s);

// ---------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------

// An arrow's own label width replaces the direction caps (arrow-labels.md "Width and wrapping").
export function capFor(u: Pt, o: ArrowLabelLayoutOptions, own?: number): number {
  return own ?? o.crossCapPx + (o.alongCapPx - o.crossCapPx) * u.x * u.x;
}

export function blockOf(
  text: string,
  width: number,
  measure: TextMeasure,
  lineHeight: number,
): Block {
  const wrapped = wrapBalanced(text, width, measure);
  return {
    lines: wrapped.lines,
    width: wrapped.width + LABEL_PAD_X_PX * 2,
    height: wrapped.lines.length * lineHeight + LABEL_PAD_Y_PX * 2,
  };
}

// Length of route a block covers when centred on a line running along `u`,
// knockout margin included.
export function footprintAlong(b: Block, u: Pt): number {
  const w = b.width + KNOCKOUT_MARGIN_PX * 2;
  const h = b.height + KNOCKOUT_MARGIN_PX * 2;
  const ax = Math.abs(u.x);
  const ay = Math.abs(u.y);
  const alongW = ax > 1e-9 ? w / ax : Infinity;
  const alongH = ay > 1e-9 ? h / ay : Infinity;
  return Math.min(alongW, alongH);
}

// The widest block, at most `cap`, whose footprint fits `room`; null when not
// even one word per line fits.
export function fittingBlock(
  text: string,
  cap: number,
  u: Pt,
  room: number,
  measure: TextMeasure,
  lineHeight: number,
  // An arrow's own label width is never narrowed: a label that does not fit at it moves beside.
  fixed = false,
): Block | null {
  const floor = longestWordWidth(text, measure);
  let width = Math.max(cap, floor);
  for (;;) {
    const b = blockOf(text, width, measure, lineHeight);
    if (footprintAlong(b, u) <= room) return b;
    if (fixed) return null;
    const textWidth = b.width - LABEL_PAD_X_PX * 2;
    if (textWidth <= floor + 0.01) return null;
    width = Math.max(floor, textWidth - 1);
  }
}

export function rectAround(c: Pt, w: number, h: number, margin = 0): Rect {
  return {
    x: c.x - w / 2 - margin,
    y: c.y - h / 2 - margin,
    width: w + margin * 2,
    height: h + margin * 2,
  };
}
