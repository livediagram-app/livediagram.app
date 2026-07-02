// Shared pure primitives for the headless SVG renderers (svg-render.ts and
// its per-element emitters: tables, shape silhouettes, freehand). Their own
// module so the emitters never import from svg-render (which imports THEM),
// keeping the graph cycle-free.
import type { BoxedElement } from './index';

export const LABEL_LINE_HEIGHT = 1.25;

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// XML-escape for both text nodes and attribute values.
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fontSizeFor(textSize: BoxedElement['textSize']): number {
  return textSize === 'lg' ? 20 : textSize === 'sm' ? 12 : textSize === 'scale' ? 18 : 14;
}

// Horizontal room a label has inside its element (box width minus the ~8px
// inset each side), so long labels wrap inside the element.
export function labelMaxWidth(el: BoxedElement): number {
  return Math.max(8, el.width - 16);
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
export function labelMeasure(size: number, bold: boolean, italic: boolean): (s: string) => number {
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
  ctx.font = `${bold ? '600' : '400'} ${italic ? 'italic ' : ''}${size}px system-ui, sans-serif`;
  return (s) => ctx.measureText(s).width;
}
