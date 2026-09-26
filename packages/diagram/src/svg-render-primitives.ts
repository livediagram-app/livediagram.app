// Shared pure primitives for the headless SVG renderers (svg-render.ts and
// its per-element emitters: tables, shape silhouettes, freehand). Their own
// module so the emitters never import from svg-render (which imports THEM),
// keeping the graph cycle-free.
import { labelFontPx } from './label-font';
import type { BoxedElement } from './index';

// XML-escape for both text nodes and attribute values. Re-exported rather
// than defined here: @livediagram/icons owns the one escaper the monorepo's
// SVG builders share, and this package already depends on it. Every existing
// `xmlEscape` import from here (and from the package barrel) still resolves.
export { xmlEscape } from '@livediagram/icons';

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

// Greedy word-wrap to a max pixel width, preserving explicit newlines.
export function wrapLabel(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let cur = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const w = words[i]!;
      if (measure(`${cur} ${w}`) <= maxWidth) cur += ` ${w}`;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  return out;
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
  if (!ctx) return (s) => s.length * size * 0.55;
  ctx.font = `${bold ? '600' : '400'} ${italic ? 'italic ' : ''}${size}px ${
    fontFamily ?? 'system-ui, sans-serif'
  }`;
  return (s) => ctx.measureText(s).width;
}
