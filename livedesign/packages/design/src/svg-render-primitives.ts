// Shared pure primitives for the headless SVG renderers (svg-render.ts and
// its per-element emitters: tables, shape silhouettes, freehand). Their own
// module so the emitters never import from svg-render (which imports THEM),
// keeping the graph cycle-free.
import { labelFontPx } from '@liveworkspace/model-core/label-font';
import type { BoxedElement } from './index';

// XML-escape for both text nodes and attribute values. Re-exported rather
// than defined here: @liveworkspace/icons owns the one escaper the monorepo's
// SVG builders share, and this package already depends on it. Every existing
// `xmlEscape` import from here (and from the package barrel) still resolves.
import type { ExportIconArt } from './svg-render-describe';
import { xmlEscape } from '@liveworkspace/icons';
export { xmlEscape };

export const LABEL_LINE_HEIGHT = 1.25;

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// The canvas's own table (label-font.ts), not a second one: this used to
// return 12 / 14 / 20 / 18 against the canvas's 14 / 22 / 32 / 16, so every
// exported label came out about two thirds the size it was drawn at.
export function fontSizeFor(textSize: BoxedElement['textSize'], multiline = false): number {
  return labelFontPx(textSize, multiline);
}

// Horizontal room a label has inside its element (box width minus the
// inset each side — the element's padding when the caller resolves it,
// else the historical ~8px), so long labels wrap inside the element.
export function labelMaxWidth(el: BoxedElement, pad = 8): number {
  return Math.max(8, el.width - pad * 2);
}

// Greedy word-wrap to a max pixel width, preserving explicit newlines. With
// `breakWords`, a word wider than the line breaks between characters, as a
// box label's break-words does on the canvas ("smartwat" / "ch" on a narrow
// watch face); without it (an icon caption) the word stays whole.
// A word's characters as a reader counts them (grapheme clusters: a flag or a joined emoji is one), else its code
// points where the runtime has no segmenter. One segmenter, made on first use.
const SIMPLE_TEXT = /^[\u0020-\u02ff]*$/;
let _segmenter: Intl.Segmenter | null | undefined;
export function graphemes(s: string): string[] {
  if (_segmenter === undefined)
    _segmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;
  return _segmenter ? Array.from(_segmenter.segment(s), (g) => g.segment) : [...s];
}

export function wrapLabel(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  breakWords = false,
): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let cur = '';
    for (const word of words) {
      if (!cur) cur = word;
      else if (measure(`${cur} ${word}`) <= maxWidth) cur += ` ${word}`;
      else {
        out.push(cur);
        cur = word;
      }
      // Too wide on its own line: peel off what fits, a character at a time. Characters as a reader sees them, so
      // an emoji (two UTF-16 units, or several joined) is never cut in half into two broken glyphs.
      // Segmented once per too-wide word; the cuts are string slices at its characters' offsets.
      if (breakWords && measure(cur) > maxWidth) {
        const ends: number[] = [];
        let at = 0;
        // Text with nothing past the Latin letters (no emoji, no combining mark) is one character per unit.
        if (SIMPLE_TEXT.test(cur)) for (let i = 1; i <= cur.length; i++) ends.push(i);
        else for (const g of graphemes(cur)) ends.push((at += g.length));
        let first = 0;
        let from = 0;
        while (ends.length - first > 1 && measure(cur.slice(from)) > maxWidth) {
          let n = ends.length - 1;
          while (n > first + 1 && measure(cur.slice(from, ends[n - 1])) > maxWidth) n--;
          const to = ends[n - 1]!;
          out.push(cur.slice(from, to));
          from = to;
          first = n;
        }
        cur = cur.slice(from);
      }
    }
    out.push(cur);
  }
  return out;
}

// The width of a label with no canvas to measure it: a rough share of the font size a character
// (docs/specs/024-agents/blueprints/page-lint.md, LN4). Headless renders and the page lint both wrap
// with it, so the lint judges the text an agent's preview shows.
export const LABEL_ESTIMATE_CHAR_EM = 0.55;
export function estimatedLabelMeasure(size: number): (s: string) => number {
  return (s) => s.length * size * LABEL_ESTIMATE_CHAR_EM;
}

// A reusable measuring 2D context for the SVG path. Null in non-DOM
// environments (Workers / jsdom), where we fall back to a rough
// character-width estimate so wrapping degrades gracefully.
type MeasureCtx = { measureText: (s: string) => { width: number }; font: string };
let _labelMeasureCtx: MeasureCtx | null | undefined;
// `fontFamily` is the CSS stack the text will actually be painted in
// (docs/specs/004-interface-design/fonts.md). Faces differ in width at the same px — a marker face is far
// wider than the UI sans — so a caller that knows the family passes it and
// gets a measurement of the text as it will look, not as system-ui would.
// Omitted, the historical system-ui measurement applies.
export function labelMeasure(
  size: number,
  bold: boolean,
  italic: boolean,
  fontFamily?: string,
): (s: string) => number {
  if (_labelMeasureCtx === undefined) {
    // Reach `document` via globalThis so this module typechecks under a no-DOM
    // lib (the api / mcp Workers) and still uses the real canvas measure in the
    // browser. Absent in Workers -> char-width fallback below.
    const doc = (
      globalThis as {
        document?: { createElement(tag: string): { getContext(ctx: string): unknown } };
      }
    ).document;
    _labelMeasureCtx = doc
      ? (doc.createElement('canvas').getContext('2d') as MeasureCtx | null)
      : null;
  }
  const ctx = _labelMeasureCtx;
  if (!ctx) return estimatedLabelMeasure(size);
  ctx.font = `${bold ? '600' : '400'} ${italic ? 'italic ' : ''}${size}px ${
    fontFamily ?? 'system-ui, sans-serif'
  }`;
  return (s) => ctx.measureText(s).width;
}

/** An icon's art drawn in `r` (relative to the element at `el`), as the card and the boundary draw theirs: a coloured
 *  icon keeps its own paint, a line icon is stroked in `colour`. */
export function svgIconGlyph(
  el: { x: number; y: number },
  art: ExportIconArt,
  r: { x: number; y: number; width: number; height: number },
  colour: string,
): string {
  const attrs = art.colored
    ? ''
    : ` fill="none" stroke="${xmlEscape(colour)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return (
    `<svg x="${r2(el.x + r.x)}" y="${r2(el.y + r.y)}" width="${r2(r.width)}" height="${r2(r.height)}"` +
    ` viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" overflow="visible"${attrs}>${art.markup}</svg>`
  );
}
