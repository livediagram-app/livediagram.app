// The walk over a parsed SVG (docs/specs/020-import-export/svg-import.md): every drawn element in document order,
// its geometry carried through its transforms into the root's user space and its paint resolved through the
// cascade. Reads only what it needs from an inert document and never copies markup: scripts, foreignObject,
// embedded media and references outside the file are never followed. Bounded by the element budget and the `<use>`
// depth.
import { SVG_IMPORT_MAX_ELEMENTS, SVG_USE_MAX_DEPTH } from './constants';
import { parseColour, type Rgba } from './colour';
import {
  IDENTITY,
  maxScaleOf,
  multiply,
  scaleOf,
  transformContour,
  type Contour,
  type Matrix,
} from './geometry';
import { numberList } from './number-scan';
import { parsePathData } from './path-data';
import { emptySvgReport, type SvgImportReport } from './report';
import { shapeContours, parseLength, type Viewport } from './shapes';
import {
  parseDeclarations,
  STYLE_PROPERTIES,
  StyleSheet,
  type Declarations,
  type StyleProperty,
} from './style';
import { parseTransform } from './transform';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** One drawn element: its contours in the root's user space and its resolved paint. */
export type Drawn = {
  contours: Contour[];
  fill: Rgba | null;
  // The stroke's width in root user units (its own width times its transforms' scale).
  stroke: (Rgba & { width: number }) | null;
  fillRule: 'nonzero' | 'evenodd';
  // The element's opacity, multiplied down its groups.
  opacity: number;
};

export type WalkResult =
  | { ok: true; drawn: Drawn[]; report: SvgImportReport; viewport: Viewport }
  | { ok: false; reason: 'too-many-elements' };

// Elements whose content never draws where it stands.
const NEVER_DRAWN = new Set([
  'defs',
  'symbol',
  'clipPath',
  'mask',
  'pattern',
  'marker',
  'linearGradient',
  'radialGradient',
  'filter',
  'style',
  'script',
  'foreignObject',
  'iframe',
  'audio',
  'video',
  'canvas',
  'metadata',
  'title',
  'desc',
  'switch',
]);
const CONTAINERS = new Set(['g', 'a', 'svg']);
const INHERITED: readonly StyleProperty[] = [
  'fill',
  'stroke',
  'stroke-width',
  'fill-rule',
  'fill-opacity',
  'stroke-opacity',
  'color',
  'visibility',
];
// The deepest nesting walked; anything deeper is left out (no real file nests this far).
const MAX_DEPTH = 256;

type Ctx = {
  matrix: Matrix;
  style: Declarations;
  opacity: number;
  useDepth: number;
};

const inSvg = (el: Element) => el.namespaceURI === SVG_NS || el.namespaceURI === null;

// A fraction from a number or a percentage, clamped to 0..1; `fallback` when unreadable.
function fraction(raw: string | undefined, fallback = 1): number {
  if (raw === undefined) return fallback;
  const t = raw.trim();
  const pct = t.endsWith('%');
  const v = Number(pct ? t.slice(0, -1) : t);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, pct ? v / 100 : v));
}

// The id a local reference names (`#id`), or null for one outside the file (`http:`, `data:`, another file).
function localId(ref: string | null): string | null {
  if (!ref) return null;
  const t = ref.trim();
  return t.startsWith('#') && t.length > 1 ? t.slice(1) : null;
}

// A `url(...)` value's reference and fallback paint (`url(#g) red`), or null when the value is not a url.
function urlOf(value: string): { id: string | null; fallback: string } | null {
  const t = value.trim();
  if (!t.toLowerCase().startsWith('url(')) return null;
  const close = t.indexOf(')');
  if (close < 0) return { id: null, fallback: '' };
  let inner = t.slice(4, close).trim();
  if ((inner[0] === '"' || inner[0] === "'") && inner[inner.length - 1] === inner[0])
    inner = inner.slice(1, -1);
  return { id: localId(inner), fallback: t.slice(close + 1).trim() };
}

function hrefOf(el: Element): string | null {
  return el.getAttribute('href') ?? el.getAttributeNS(XLINK_NS, 'href');
}

/** Walks the SVG under `root`. `pxPerUnit` is the landed px one root unit becomes (for arc precision). */
export function walkSvg(root: Element, pxPerUnit: number): WalkResult {
  const report = emptySvgReport();
  const ids = new Map<string, Element>();
  const sheet = new StyleSheet();
  const all = root.getElementsByTagName('*');
  if (all.length + 1 > SVG_IMPORT_MAX_ELEMENTS) return { ok: false, reason: 'too-many-elements' };
  for (const el of [root, ...Array.from(all)]) {
    const id = el.getAttribute('id');
    if (id && !ids.has(id)) ids.set(id, el);
    if (el.localName === 'style' && inSvg(el)) sheet.add(el.textContent ?? '');
  }
  const viewport = viewportOf(root);
  const drawn: Drawn[] = [];
  // Elements visited, uses expanded: the budget a file of `<use>` chains cannot get round.
  let visited = 0;
  let overBudget = false;

  const declared = (el: Element): Declarations => {
    const out: Declarations = {};
    for (const p of STYLE_PROPERTIES) {
      const v = el.getAttribute(p);
      if (v !== null && v.trim()) out[p] = v.trim();
    }
    const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    Object.assign(out, sheet.match(el.localName.toLowerCase(), el.getAttribute('id'), classes));
    const inline = el.getAttribute('style');
    if (inline) Object.assign(out, parseDeclarations(inline));
    return out;
  };

  const computed = (own: Declarations, parent: Declarations): Declarations => {
    const out: Declarations = {};
    for (const p of INHERITED) if (parent[p] !== undefined) out[p] = parent[p];
    for (const [k, v] of Object.entries(own) as [StyleProperty, string][]) {
      if (v === 'inherit') {
        if (parent[k] !== undefined) out[k] = parent[k];
      } else out[k] = v;
    }
    return out;
  };

  // A gradient's first stop, following `href` to the gradient that holds the stops.
  const firstStop = (grad: Element): Rgba | null => {
    let g: Element | undefined = grad;
    for (let hops = 0; g && hops <= SVG_USE_MAX_DEPTH; hops++) {
      const stop = Array.from(g.children).find((c) => c.localName === 'stop' && inSvg(c));
      if (stop) {
        const d = declared(stop);
        const colour = parseColour(d['stop-color'] ?? 'black');
        if (!colour) return null;
        return { hex: colour.hex, alpha: colour.alpha * fraction(d['stop-opacity']) };
      }
      const next = localId(hrefOf(g));
      g = next ? ids.get(next) : undefined;
      if (g && !g.localName.endsWith('Gradient')) g = undefined;
    }
    return null;
  };

  // A paint value as a colour, or null for no paint; counts the gradients and patterns it meets.
  const paint = (value: string | undefined, style: Declarations, fallback: string): Rgba | null => {
    const v = (value ?? fallback).trim();
    if (v === 'none') return null;
    if (v.toLowerCase() === 'currentcolor') return parseColour(style.color ?? 'black');
    const url = urlOf(v);
    if (url) {
      const target = url.id ? ids.get(url.id) : undefined;
      if (
        target &&
        (target.localName === 'linearGradient' || target.localName === 'radialGradient')
      ) {
        report.gradient++;
        return firstStop(target);
      }
      if (target?.localName === 'pattern') report.pattern++;
      return url.fallback ? paint(url.fallback, style, 'none') : null;
    }
    return parseColour(v);
  };

  const drawShape = (el: Element, ctx: Ctx, style: Declarations, opacity: number) => {
    const tag = el.localName;
    const px = pxPerUnit * maxScaleOf(ctx.matrix);
    const local =
      tag === 'path'
        ? parsePathData(el.getAttribute('d') ?? '', px)
        : shapeContours(tag, (n) => el.getAttribute(n), viewport, px);
    if (!local || local.length === 0) return;
    const fill = paint(style.fill, style, 'black');
    const strokePaint = paint(style.stroke, style, 'none');
    const width = parseLength(style['stroke-width'] ?? null, 'd', viewport, 1);
    const stroke =
      strokePaint && width > 0 ? { ...strokePaint, width: width * scaleOf(ctx.matrix) } : null;
    const fillAlpha = fill ? fill.alpha * fraction(style['fill-opacity']) : 0;
    const strokeAlpha = stroke ? stroke.alpha * fraction(style['stroke-opacity']) : 0;
    const shownFill = fill && fillAlpha > 0 ? fill : null;
    const shownStroke = stroke && strokeAlpha > 0 ? stroke : null;
    if (!shownFill && !shownStroke) return;
    drawn.push({
      contours: local.map((c) => transformContour(c, ctx.matrix)),
      fill: shownFill ? { hex: shownFill.hex, alpha: fillAlpha } : null,
      stroke: shownStroke ? { ...shownStroke, alpha: strokeAlpha } : null,
      fillRule: style['fill-rule']?.trim() === 'evenodd' ? 'evenodd' : 'nonzero',
      opacity,
    });
  };

  const visit = (el: Element, ctx: Ctx, depth: number, useChain: readonly Element[]) => {
    if (overBudget || depth > MAX_DEPTH || !inSvg(el)) return;
    if (++visited > SVG_IMPORT_MAX_ELEMENTS) {
      overBudget = true;
      return;
    }
    const tag = el.localName;
    if (NEVER_DRAWN.has(tag)) return;
    const own = declared(el);
    if (own.display?.trim() === 'none') return;
    const style = computed(own, ctx.style);
    const opacity = ctx.opacity * fraction(own.opacity);
    const hidden = style.visibility?.trim() === 'hidden' || style.visibility?.trim() === 'collapse';
    let matrix = multiply(ctx.matrix, parseTransform(el.getAttribute('transform')));
    // What drawn content would lose: counted once per element that asks for it.
    if (own['clip-path'] && own['clip-path'] !== 'none') report.clipPath++;
    if (own.mask && own.mask !== 'none') report.mask++;
    if (own.filter && own.filter !== 'none') report.filter++;

    if (tag === 'text') {
      if (!hidden) report.text++;
      return;
    }
    if (tag === 'image') {
      if (!hidden) report.image++;
      return;
    }
    if (tag === 'use') {
      const id = localId(hrefOf(el));
      const target = id ? ids.get(id) : undefined;
      if (!target || useChain.includes(target) || ctx.useDepth >= SVG_USE_MAX_DEPTH) return;
      const x = parseLength(el.getAttribute('x'), 'x', viewport);
      const y = parseLength(el.getAttribute('y'), 'y', viewport);
      matrix = multiply(matrix, [1, 0, 0, 1, x, y]);
      const next: Ctx = { matrix, style, opacity, useDepth: ctx.useDepth + 1 };
      const chain = [...useChain, el, target];
      if (target.localName === 'symbol') {
        for (const child of Array.from(target.children)) visit(child, next, depth + 1, chain);
      } else visit(target, next, depth + 1, chain);
      return;
    }
    if (CONTAINERS.has(tag)) {
      if (tag === 'svg' && el !== root) matrix = multiply(matrix, nestedViewBox(el, viewport));
      const next: Ctx = { matrix, style, opacity, useDepth: ctx.useDepth };
      for (const child of Array.from(el.children)) visit(child, next, depth + 1, useChain);
      return;
    }
    if (!hidden) drawShape(el, { ...ctx, matrix }, style, opacity);
  };

  visit(root, { matrix: IDENTITY, style: {}, opacity: 1, useDepth: 0 }, 0, []);
  if (overBudget) return { ok: false, reason: 'too-many-elements' };
  return { ok: true, drawn, report, viewport };
}

/** The root's viewport (its viewBox, else its width and height, else SVG's default 300 by 150), for percentages. */
export function viewportOf(root: Element): Viewport {
  const vb = numberList(root.getAttribute('viewBox') ?? '');
  if (vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) return { width: vb[2]!, height: vb[3]! };
  const fallback = { width: 300, height: 150 };
  const width = parseLength(root.getAttribute('width'), 'x', fallback, 300);
  const height = parseLength(root.getAttribute('height'), 'y', fallback, 150);
  return { width: width > 0 ? width : 300, height: height > 0 ? height : 150 };
}

// A nested `<svg>`'s placement: its x and y, and its viewBox fitted into its width and height, centred (the
// default `xMidYMid meet`).
function nestedViewBox(el: Element, vp: Viewport): Matrix {
  const x = parseLength(el.getAttribute('x'), 'x', vp);
  const y = parseLength(el.getAttribute('y'), 'y', vp);
  const vb = numberList(el.getAttribute('viewBox') ?? '');
  if (vb.length !== 4 || !(vb[2]! > 0) || !(vb[3]! > 0)) return [1, 0, 0, 1, x, y];
  const w = parseLength(el.getAttribute('width'), 'x', vp, vb[2]);
  const h = parseLength(el.getAttribute('height'), 'y', vp, vb[3]);
  const s = Math.min(w / vb[2]!, h / vb[3]!);
  const tx = x + (w - vb[2]! * s) / 2 - vb[0]! * s;
  const ty = y + (h - vb[3]! * s) / 2 - vb[1]! * s;
  return [s, 0, 0, s, tx, ty];
}
