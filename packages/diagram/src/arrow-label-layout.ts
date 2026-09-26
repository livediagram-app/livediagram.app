// Arrow label layout (docs/specs/008-canvas/arrow-labels.md, blueprint
// docs/specs/008-canvas/blueprints/arrow-labels.md).
//
// A label sits ON its line, centred in the open run, with the line knocked
// out behind it. Its width follows the line's local direction: along a
// horizontal run the text uses up line, so the run limits it; across a
// vertical run it only uses its own height, so a readable cap limits it.
// Too short to hold the label at any wrap, it moves beside the line.
//
// Pure and shared: the canvas and every export lay labels out through here,
// so an exported label wraps at the same words and sits at the same spot.

import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { arrowLabelFontSize } from './arrow-label';
import { longestWordWidth, wrapBalanced, type TextMeasure } from './arrow-label-wrap';
import { arrowLabelAnchor, arrowPathPolyline } from './arrow-path';
import { ARROWHEAD_SIZE_PX, arrowheadShapeOf, arrowheadSizeOf, arrowStyleOf } from './arrow-style';
import { endpointPosition } from './geometry';
import { rectsIntersect, type Rect } from './geometry-primitives';
import {
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';
import { LABEL_LINE_HEIGHT, labelMeasure } from './svg-render-primitives';

type Pt = { x: number; y: number };

export const END_STUB_PX = 12;
export const LABEL_PAD_X_PX = 4;
export const LABEL_PAD_Y_PX = 2;
export const KNOCKOUT_MARGIN_PX = 3;
export const KNOCKOUT_RADIUS_PX = 4;
export const BESIDE_GAP_PX = 6;
export const LOCAL_DIRECTION_WINDOW_PX = 24;
export const CROSS_CAP_PX = 160;
export const ALONG_CAP_PX = 240;
export const HORIZONTAL_TOLERANCE_DEG = 20;
export const CHAR_WIDTH_FALLBACK_PX = 7;
const WORD_WIDTH_CACHE_MAX = 2000;
// Slide candidates: twelfths of the open run, kept to its middle half.
const SLIDE_DIVISIONS = 12;

export type AngledLabelStrategy =
  'route-middle' | 'longest-segment' | 'middle-segment' | 'horizontal-preferred';

export type ArrowLabelMeasureFor = (
  fontPx: number,
  bold: boolean,
  italic: boolean,
  family?: string,
) => TextMeasure;

export type ArrowLabelLayoutOptions = {
  angledStrategy: AngledLabelStrategy;
  crossCapPx: number;
  alongCapPx: number;
  knockoutOthers: boolean;
  fontFamilyOf?: (arrow: ArrowElement) => string | undefined;
  measureFor?: ArrowLabelMeasureFor;
};

export const DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS: ArrowLabelLayoutOptions = {
  angledStrategy: 'longest-segment',
  crossCapPx: CROSS_CAP_PX,
  alongCapPx: ALONG_CAP_PX,
  knockoutOthers: false,
};

export type ArrowLabelLayout = {
  mode: 'on-line' | 'beside' | 'placed';
  center: Pt;
  lines: string[];
  fontPx: number;
  lineHeightPx: number;
  // Plate size: the text block plus its padding.
  width: number;
  height: number;
  knockout: Rect | null;
};

type Block = { lines: string[]; width: number; height: number };

// ---------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------

const wordWidths = new Map<string, number>();

function cachedMeasure(key: string, measure: TextMeasure, fontPx: number): TextMeasure {
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
const defaultMeasureFor: ArrowLabelMeasureFor = (px, bold, italic, family) => (s) =>
  labelMeasure(px, bold, italic, family)(s);

// ---------------------------------------------------------------------
// Route geometry
// ---------------------------------------------------------------------

type Route = { pts: Pt[]; cum: number[]; length: number };

function routeOf(pts: Pt[]): Route {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  return { pts, cum, length: cum[cum.length - 1] ?? 0 };
}

function pointAt(r: Route, s: number): Pt {
  const d = Math.max(0, Math.min(r.length, s));
  for (let i = 1; i < r.pts.length; i++) {
    if (d <= r.cum[i]! || i === r.pts.length - 1) {
      const seg = r.cum[i]! - r.cum[i - 1]!;
      const f = seg > 1e-9 ? (d - r.cum[i - 1]!) / seg : 0;
      const a = r.pts[i - 1]!;
      const b = r.pts[i]!;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return r.pts[0] ?? { x: 0, y: 0 };
}

function directionAt(r: Route, s: number): Pt {
  const a = pointAt(r, s - LOCAL_DIRECTION_WINDOW_PX);
  const b = pointAt(r, s + LOCAL_DIRECTION_WINDOW_PX);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return len > 1e-9 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
}

function resolvedEnds(arrow: ArrowElement, elements: Element[]): { from: Pt; to: Pt } {
  const rawFrom = endpointPosition(arrow.from, elements);
  const rawTo = endpointPosition(arrow.to, elements);
  const fs = arrowEndpointSpread(arrow.id, 'from', elements);
  const ts = arrowEndpointSpread(arrow.id, 'to', elements);
  return {
    from: { x: rawFrom.x + fs.x, y: rawFrom.y + fs.y },
    to: { x: rawTo.x + ts.x, y: rawTo.y + ts.y },
  };
}

function arrowRoute(arrow: ArrowElement, elements: Element[]): { route: Route; from: Pt; to: Pt } {
  const { from, to } = resolvedEnds(arrow, elements);
  const pts = arrowPathPolyline(
    arrowStyleOf(arrow),
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  return { route: routeOf(pts), from, to };
}

// The drawn route as a polyline, endpoints resolved the way both renderers do.
export function arrowRoutePoints(arrow: ArrowElement, elements: Element[]): Pt[] {
  return arrowRoute(arrow, elements).route.pts;
}

function headLength(arrow: ArrowElement): number {
  const shape = arrowheadShapeOf(arrow);
  const base = (8 / ARROWHEAD_SIZE_PX.medium) * ARROWHEAD_SIZE_PX[arrowheadSizeOf(arrow)];
  return shape === 'diamond' || shape === 'diamond-hollow' ? base * 1.5 : base;
}

function endClearances(arrow: ArrowElement): { start: number; end: number } {
  const ends = arrow.arrowEnds ?? 'to';
  const head = headLength(arrow) + END_STUB_PX;
  return {
    start: ends === 'from' || ends === 'both' ? head : END_STUB_PX,
    end: ends === 'to' || ends === 'both' ? head : END_STUB_PX,
  };
}

// ---------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------

function capFor(u: Pt, o: ArrowLabelLayoutOptions): number {
  return o.crossCapPx + (o.alongCapPx - o.crossCapPx) * u.x * u.x;
}

function blockOf(text: string, width: number, measure: TextMeasure, lineHeight: number): Block {
  const wrapped = wrapBalanced(text, width, measure);
  return {
    lines: wrapped.lines,
    width: wrapped.width + LABEL_PAD_X_PX * 2,
    height: wrapped.lines.length * lineHeight + LABEL_PAD_Y_PX * 2,
  };
}

// Length of route a block covers when centred on a line running along `u`,
// knockout margin included.
function footprintAlong(b: Block, u: Pt): number {
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
function fittingBlock(
  text: string,
  cap: number,
  u: Pt,
  room: number,
  measure: TextMeasure,
  lineHeight: number,
): Block | null {
  const floor = longestWordWidth(text, measure);
  let width = Math.max(cap, floor);
  for (;;) {
    const b = blockOf(text, width, measure, lineHeight);
    if (footprintAlong(b, u) <= room) return b;
    const textWidth = b.width - LABEL_PAD_X_PX * 2;
    if (textWidth <= floor + 0.01) return null;
    width = Math.max(floor, textWidth - 1);
  }
}

function rectAround(c: Pt, w: number, h: number, margin = 0): Rect {
  return {
    x: c.x - w / 2 - margin,
    y: c.y - h / 2 - margin,
    width: w + margin * 2,
    height: h + margin * 2,
  };
}

// ---------------------------------------------------------------------
// Host span (which part of the route may hold the label)
// ---------------------------------------------------------------------

type Span = { start: number; end: number; atRouteStart: boolean; atRouteEnd: boolean };

function segmentSpans(r: Route): Span[] {
  const spans: Span[] = [];
  for (let i = 1; i < r.pts.length; i++) {
    spans.push({
      start: r.cum[i - 1]!,
      end: r.cum[i]!,
      atRouteStart: i === 1,
      atRouteEnd: i === r.pts.length - 1,
    });
  }
  return spans;
}

function openRunOf(span: Span, clear: { start: number; end: number }): [number, number] {
  return [
    span.start + (span.atRouteStart ? clear.start : END_STUB_PX),
    span.end - (span.atRouteEnd ? clear.end : END_STUB_PX),
  ];
}

function hostSpan(
  arrow: ArrowElement,
  r: Route,
  o: ArrowLabelLayoutOptions,
  linesOn: (span: Span) => number | null,
): Span {
  const whole: Span = { start: 0, end: r.length, atRouteStart: true, atRouteEnd: true };
  if (arrowStyleOf(arrow) !== 'angled' || r.pts.length < 3) return whole;
  const segs = segmentSpans(r);
  const longest = segs.reduce((best, s) => (s.end - s.start > best.end - best.start ? s : best));
  switch (o.angledStrategy) {
    case 'route-middle':
      return whole;
    case 'longest-segment':
      return longest;
    case 'middle-segment':
      return segs.find((s) => r.length / 2 <= s.end) ?? longest;
    case 'horizontal-preferred': {
      // A horizontal run wins only if it holds the label on no more lines than
      // the longest run would.
      const most = linesOn(longest) ?? Infinity;
      const tol = Math.sin((HORIZONTAL_TOLERANCE_DEG * Math.PI) / 180);
      const horizontal = segs
        .filter((s, i) => {
          const a = r.pts[i]!;
          const b = r.pts[i + 1]!;
          const len = s.end - s.start;
          const lines = linesOn(s);
          return len > 1e-9 && Math.abs(b.y - a.y) / len <= tol && lines !== null && lines <= most;
        })
        .sort((a, b) => b.end - b.start - (a.end - a.start));
      return horizontal[0] ?? longest;
    }
  }
}

// ---------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------

function isObstacle(el: BoxedElement): boolean {
  return !(el.type === 'shape' && (el.shape === 'frame' || el.shape === 'lane'));
}

function hitsAny(rect: Rect, boxes: Rect[]): boolean {
  return boxes.some((b) => rectsIntersect(rect, b));
}

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------

export type ArrowLabelContext = {
  elements: Element[];
  // Rects already claimed by earlier labels.
  claimed: Rect[];
  options: ArrowLabelLayoutOptions;
};

export function layoutArrowLabel(
  arrow: ArrowElement,
  text: string,
  ctx: ArrowLabelContext,
): ArrowLabelLayout | null {
  if (!text.trim()) return null;
  const o = ctx.options;
  const fontPx = arrowLabelFontSize(arrow.textSize);
  const lineHeightPx = fontPx * LABEL_LINE_HEIGHT;
  const family = o.fontFamilyOf?.(arrow);
  const measure = cachedMeasure(
    `${fontPx}|${arrow.textBold ? 1 : 0}|${arrow.textItalic ? 1 : 0}|${family ?? ''}`,
    (o.measureFor ?? defaultMeasureFor)(fontPx, !!arrow.textBold, !!arrow.textItalic, family),
    fontPx,
  );
  const obstacles: Rect[] = [
    ...ctx.elements.filter(isBoxed).filter(isObstacle),
    ...ctx.claimed,
  ].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
  const { route, from, to } = arrowRoute(arrow, ctx.elements);
  const base = { fontPx, lineHeightPx };

  if (arrow.labelOffset) {
    const style = arrowStyleOf(arrow);
    const center = arrowLabelAnchor(
      style,
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    const u = directionAt(route, arrow.labelOffset.t * route.length);
    const b = blockOf(text, capFor(u, o), measure, lineHeightPx);
    const reach = Math.abs(u.y) * (b.width / 2) + Math.abs(u.x) * (b.height / 2);
    return {
      ...base,
      mode: 'placed',
      center,
      lines: b.lines,
      width: b.width,
      height: b.height,
      knockout:
        Math.abs(arrow.labelOffset.offset) < reach
          ? rectAround(center, b.width, b.height, KNOCKOUT_MARGIN_PX)
          : null,
    };
  }

  // Beside the line at the route middle: each side at the cap, then ever
  // narrower wraps, until one clears every obstacle; else the first side at the cap.
  const beside = (reason: string): ArrowLabelLayout => {
    const s = route.length / 2;
    const p = pointAt(route, s);
    const u = directionAt(route, s);
    const n = { x: -u.y, y: u.x };
    const place = (b: Block, sign: number): Pt => {
      const d = Math.abs(n.x) * (b.width / 2) + Math.abs(n.y) * (b.height / 2) + BESIDE_GAP_PX;
      return { x: p.x + n.x * d * sign, y: p.y + n.y * d * sign };
    };
    const floor = longestWordWidth(text, measure);
    let width = Math.max(capFor(u, o), floor);
    const first = blockOf(text, width, measure, lineHeightPx);
    let chosen: { b: Block; c: Pt } = { b: first, c: place(first, 1) };
    search: for (;;) {
      const b = blockOf(text, width, measure, lineHeightPx);
      for (const sign of [1, -1]) {
        const c = place(b, sign);
        if (!hitsAny(rectAround(c, b.width, b.height), obstacles)) {
          chosen = { b, c };
          break search;
        }
      }
      const textWidth = b.width - LABEL_PAD_X_PX * 2;
      if (textWidth <= floor + 0.01) break;
      width = Math.max(floor, textWidth - 1);
    }
    console.debug('[arrow-label]', arrow.id, 'beside', reason);
    const { b: blk, c: center } = chosen;
    return {
      ...base,
      mode: 'beside',
      center,
      lines: blk.lines,
      width: blk.width,
      height: blk.height,
      knockout: null,
    };
  };

  if (route.length < 1) return beside('short-route');
  const clear = endClearances(arrow);

  // The block a span could hold at its centre, or null.
  const blockOn = (span: Span): { block: Block; run: [number, number] } | null => {
    const run = openRunOf(span, clear);
    if (run[1] <= run[0]) return null;
    const u = directionAt(route, (run[0] + run[1]) / 2);
    const block = fittingBlock(text, capFor(u, o), u, run[1] - run[0], measure, lineHeightPx);
    return block ? { block, run } : null;
  };

  const span = hostSpan(arrow, route, o, (s) => blockOn(s)?.block.lines.length ?? null);
  const [s0, s1] = openRunOf(span, clear);
  if (s1 <= s0) return beside('empty-run');
  const fit = blockOn(span);
  if (!fit) return beside('no-fit');
  const { block } = fit;
  const sc = (s0 + s1) / 2;
  const step = (s1 - s0) / SLIDE_DIVISIONS;
  const lo = s0 + (s1 - s0) / 4;
  const hi = s1 - (s1 - s0) / 4;
  const candidates: number[] = [sc];
  for (let k = 1; k <= SLIDE_DIVISIONS; k++) {
    for (const s of [sc + k * step, sc - k * step])
      if (s >= lo - 1e-9 && s <= hi + 1e-9) candidates.push(s);
  }
  for (const s of candidates) {
    const u = directionAt(route, s);
    if (footprintAlong(block, u) > 2 * Math.min(s - s0, s1 - s) + 1e-9) continue;
    const center = pointAt(route, s);
    const knockout = rectAround(center, block.width, block.height, KNOCKOUT_MARGIN_PX);
    if (hitsAny(knockout, obstacles)) continue;
    return {
      ...base,
      mode: 'on-line',
      center,
      lines: block.lines,
      width: block.width,
      height: block.height,
      knockout,
    };
  }
  const center = pointAt(route, sc);
  return {
    ...base,
    mode: 'on-line',
    center,
    lines: block.lines,
    width: block.width,
    height: block.height,
    knockout: rectAround(center, block.width, block.height, KNOCKOUT_MARGIN_PX),
  };
}

// Every labelled arrow's layout, in document order: each label sees the ones
// before it as obstacles, so two labels never claim the same spot.
export function layoutArrowLabels(
  elements: Element[],
  options: Partial<ArrowLabelLayoutOptions> = {},
): Map<ElementId, ArrowLabelLayout> {
  const ctx: ArrowLabelContext = {
    elements,
    claimed: [],
    options: { ...DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS, ...options },
  };
  const out = new Map<ElementId, ArrowLabelLayout>();
  for (const el of elements) {
    if (el.type !== 'arrow' || !el.label) continue;
    const l = layoutArrowLabel(el, el.label, ctx);
    if (!l) continue;
    out.set(el.id, l);
    ctx.claimed.push(l.knockout ?? rectAround(l.center, l.width, l.height));
  }
  return out;
}

// The knockout rects an arrow's line mask cuts: its own label's, plus (when
// `knockoutOthers`) every other label whose knockout overlaps its route.
export function arrowKnockouts(
  arrowId: ElementId,
  elements: Element[],
  layouts: ReadonlyMap<ElementId, ArrowLabelLayout>,
  knockoutOthers: boolean,
): Rect[] {
  const own = layouts.get(arrowId)?.knockout;
  const out: Rect[] = own ? [own] : [];
  if (!knockoutOthers) return out;
  const arrow = elements.find((e): e is ArrowElement => e.id === arrowId && e.type === 'arrow');
  if (!arrow) return out;
  const { route } = arrowRoute(arrow, elements);
  for (const [id, l] of layouts) {
    if (id === arrowId || !l.knockout) continue;
    if (routeCrossesRect(route, l.knockout)) out.push(l.knockout);
  }
  return out;
}

function routeCrossesRect(r: Route, rect: Rect): boolean {
  // Sample every few px: a knockout is at least a line tall, so 4px steps
  // cannot jump across one.
  for (let s = 0; s <= r.length; s += 4) {
    const p = pointAt(r, s);
    if (p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height)
      return true;
  }
  return false;
}

// One tab's labels, laid out once and shared by every arrow a renderer
// draws: the layouts, plus each arrow's knockouts (resolved lazily, cached).
export type ArrowLabelPass = {
  layouts: ReadonlyMap<ElementId, ArrowLabelLayout>;
  knockoutsOf: (arrowId: ElementId) => Rect[];
};

export function arrowLabelPass(
  elements: Element[],
  options: Partial<ArrowLabelLayoutOptions> = {},
): ArrowLabelPass {
  const layouts = layoutArrowLabels(elements, options);
  const knockoutOthers =
    options.knockoutOthers ?? DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS.knockoutOthers;
  const cache = new Map<ElementId, Rect[]>();
  return {
    layouts,
    knockoutsOf: (id) => {
      let hit = cache.get(id);
      if (!hit) {
        hit = arrowKnockouts(id, elements, layouts, knockoutOthers);
        cache.set(id, hit);
      }
      return hit;
    },
  };
}
