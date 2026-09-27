// Where markup lands on the board (docs/specs/020-import-export/blueprints/whiteboard-import.md "Placement"):
// an anchor's `left` / `top` then its `transform` about its corner, and inside
// an item every `left` / `top`, CSS `transform`, SVG `transform` and `viewBox`
// down to the node, composed outer to inner.

import {
  compose,
  IDENTITY,
  parseCssTransform,
  parseSvgTransform,
  translate,
  type Matrix,
} from './matrix';

export type Placed = { matrix: Matrix; unknown: string[] };

/** The declarations of an element's inline `style`, by lower-case property. */
export function inlineStyle(el: Element): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    out.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim());
  }
  return out;
}

/** A `px` (or unitless) length, else null. */
export function px(value: string | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  const m = /^(-?[\d.]+(?:e-?\d+)?)(px)?$/i.exec(value.trim());
  return m ? Number(m[1]) : null;
}

function cssBox(el: Element): Placed {
  const style = inlineStyle(el);
  const left = px(style.get('left'));
  const top = px(style.get('top'));
  const at = translate(left ?? 0, top ?? 0);
  const transform = style.get('transform');
  if (!transform) return { matrix: at, unknown: [] };
  const parsed = parseCssTransform(transform);
  return { matrix: compose(at, parsed.matrix), unknown: parsed.unknown };
}

/** Anchor space to board px: `left` / `top`, then `transform` about the corner (E-5). */
export const anchorMatrix = (anchor: Element): Placed => cssBox(anchor);

const SVG_NS = 'http://www.w3.org/2000/svg';

function viewBoxMatrix(svg: Element): Matrix {
  const box = (svg.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = px(svg.getAttribute('width'));
  const height = px(svg.getAttribute('height'));
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n)) || !width || !height) {
    return IDENTITY;
  }
  const [minX, minY, vbWidth, vbHeight] = box as [number, number, number, number];
  if (vbWidth <= 0 || vbHeight <= 0) return IDENTITY;
  // preserveAspectRatio's default: xMidYMid meet.
  const s = Math.min(width / vbWidth, height / vbHeight);
  const ox = (width - vbWidth * s) / 2;
  const oy = (height - vbHeight * s) / 2;
  return { a: s, b: 0, c: 0, d: s, e: ox - minX * s, f: oy - minY * s };
}

function ownMatrix(el: Element): Placed {
  if (el.namespaceURI !== SVG_NS) return cssBox(el);
  const unknown: string[] = [];
  let matrix = IDENTITY;
  if (el.localName === 'svg') {
    // A nested <svg> sits at x/y; an outermost one follows CSS left/top.
    const css = cssBox(el);
    matrix = compose(
      css.matrix,
      translate(px(el.getAttribute('x')) ?? 0, px(el.getAttribute('y')) ?? 0),
    );
    unknown.push(...css.unknown);
    matrix = compose(matrix, viewBoxMatrix(el));
  }
  const attr = el.getAttribute('transform');
  if (attr) {
    const parsed = parseSvgTransform(attr);
    matrix = compose(matrix, parsed.matrix);
    unknown.push(...parsed.unknown);
  }
  return { matrix, unknown };
}

/** `node`'s own space to its anchor's space: every element between, outer first. */
export function innerMatrix(node: Element, anchor: Element): Placed {
  const chain: Element[] = [];
  for (let el: Element | null = node; el && el !== anchor; el = el.parentElement) chain.push(el);
  let matrix = IDENTITY;
  const unknown: string[] = [];
  for (const el of chain.reverse()) {
    const own = ownMatrix(el);
    matrix = compose(matrix, own.matrix);
    unknown.push(...own.unknown);
  }
  return { matrix, unknown };
}
