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

import { isContainerKind } from './containment';
import { arrowLabelFontSize } from '@liveworkspace/model-core/arrow-label';
import { longestWordWidth } from '@liveworkspace/model-core/arrow-label-wrap';
import { arrowLabelAnchor } from './arrow-path';
import { arrowStyleOf } from './arrow-style';
import { arrowPolyline } from './arrow-path-hits';
import { elementIndexFor } from './geometry';
import { rectsIntersect, type Rect } from '@liveworkspace/model-core/geometry-primitives';
import {
  addToRectGrid,
  anyRectMeeting,
  createRectGrid,
  eachRectMeeting,
  type RectGrid,
} from '@liveworkspace/model-core/rect-grid';
import {
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './element';
import type { ElementIndex } from './geometry';
import { LABEL_LINE_HEIGHT } from './svg-render-primitives';
import {
  arrowRoute,
  directionAt,
  endClearances,
  openRunOf,
  pointAt,
  segmentSpans,
  type Pt,
  type Route,
  type Span,
} from './arrow-label-route';
import {
  blockOf,
  cachedMeasure,
  capFor,
  defaultMeasureFor,
  fittingBlock,
  footprintAlong,
  KNOCKOUT_MARGIN_PX,
  LABEL_PAD_X_PX,
  rectAround,
  type ArrowLabelLayoutOptions,
  type Block,
} from './arrow-label-blocks';

// The route geometry and the text blocks live beside this file; re-exported so callers' imports stay as they were.
export { arrowResolvedEnds, arrowRoutePoints } from './arrow-label-route';
export {
  KNOCKOUT_MARGIN_PX,
  LABEL_PAD_X_PX,
  LABEL_PAD_Y_PX,
  type ArrowLabelLayoutOptions,
  type ArrowLabelMeasureFor,
} from './arrow-label-blocks';

export const KNOCKOUT_RADIUS_PX = 4;
const BESIDE_GAP_PX = 6;
const CROSS_CAP_PX = 120;
const ALONG_CAP_PX = 240;
// Slide candidates: twelfths of the open run, at most a quarter of it either
// side of the preferred centre.
const SLIDE_DIVISIONS = 12;

export const DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS: ArrowLabelLayoutOptions = {
  crossCapPx: CROSS_CAP_PX,
  alongCapPx: ALONG_CAP_PX,
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

// Where an on-line label goes: the span it may occupy and its preferred centre.
// The route middle, unless the label would straddle a corner there; then the
// longest segment, at the spot on it closest to the route middle
// (docs/specs/008-canvas/arrow-labels.md "Placement").
function placementOf(
  arrow: ArrowElement,
  r: Route,
  clear: { start: number; end: number },
  blockOn: (span: Span) => { block: Block; run: [number, number] } | null,
): { span: Span; sc: number } {
  const whole: Span = { start: 0, end: r.length, atRouteStart: true, atRouteEnd: true };
  const [w0, w1] = openRunOf(whole, clear);
  const sm = (w0 + w1) / 2;
  if (arrowStyleOf(arrow) !== 'angled' || r.pts.length < 3) return { span: whole, sc: sm };
  const segs = segmentSpans(r);
  const halfOn = (fit: { block: Block }, s: number) =>
    footprintAlong(fit.block, directionAt(r, s)) / 2;
  const middle = segs.find((s) => sm <= s.end) ?? segs[segs.length - 1]!;
  const onMiddle = blockOn(middle);
  if (onMiddle) {
    const [a, b] = onMiddle.run;
    const half = halfOn(onMiddle, sm);
    if (sm - a >= half && b - sm >= half) return { span: middle, sc: sm };
  }
  const longest = segs.reduce((best, s) => (s.end - s.start > best.end - best.start ? s : best));
  const onLongest = blockOn(longest);
  if (!onLongest) return { span: longest, sc: (longest.start + longest.end) / 2 };
  const [a, b] = onLongest.run;
  const half = halfOn(onLongest, (a + b) / 2);
  const sc = a + half <= b - half ? Math.min(b - half, Math.max(a + half, sm)) : (a + b) / 2;
  return { span: longest, sc };
}

// ---------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------

function isObstacle(el: BoxedElement): boolean {
  return !(el.type === 'shape' && isContainerKind(el.shape));
}

function hitsAny(rect: Rect, boxes: Rect[]): boolean {
  return boxes.some((b) => rectsIntersect(rect, b));
}

// The boxes a label steers clear of, in a grid of their own, built once per board (by the array's identity, as the
// element index is): a label asks its neighbourhood, not every box on the board
// (docs/specs/008-canvas/canvas-performance.md "Arrow labels ask their neighbourhood").
const obstacleGrids = new WeakMap<readonly Element[], RectGrid>();
function obstacleGridFor(elements: readonly Element[]): RectGrid {
  let grid = obstacleGrids.get(elements);
  if (!grid) {
    grid = createRectGrid();
    let n = 0;
    for (const el of elements)
      if (isBoxed(el) && isObstacle(el))
        addToRectGrid(grid, String(n++), { x: el.x, y: el.y, width: el.width, height: el.height });
    obstacleGrids.set(elements, grid);
  }
  return grid;
}

// Every label's claimed rect (its knockout, else its plate) by arrow id, in a grid: what a label being typed or
// dragged avoids (the editor's draftLayout), built once per label pass rather than once per label.
export function labelClaimGrid(
  layouts: Iterable<readonly [ElementId, ArrowLabelLayout | null | undefined]>,
): RectGrid {
  const grid = createRectGrid();
  for (const [id, l] of layouts)
    if (l) addToRectGrid(grid, id, l.knockout ?? rectAround(l.center, l.width, l.height));
  return grid;
}

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------

type ArrowLabelContext = {
  elements: Element[];
  // Rects already claimed by earlier labels.
  claimed: Rect[];
  // More claimed rects, in a grid (layoutArrowLabels' as it places, labelClaimGrid's for a draft), less `except`'s:
  // the same as listing them in `claimed`, asked by neighbourhood.
  claimedGrid?: { grid: RectGrid; except?: ElementId };
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
    `${o.fontEpoch ?? 0}|${fontPx}|${arrow.textBold ? 1 : 0}|${arrow.textItalic ? 1 : 0}|${family ?? ''}`,
    (o.measureFor ?? defaultMeasureFor)(fontPx, !!arrow.textBold, !!arrow.textItalic, family),
    fontPx,
  );
  // Whether a rect meets a box or a claimed rect: the board's boxes and the claimed grid by neighbourhood.
  const boxes = obstacleGridFor(ctx.elements);
  const claimedGrid = ctx.claimedGrid;
  const hits = (rect: Rect) =>
    anyRectMeeting(boxes, rect) ||
    hitsAny(rect, ctx.claimed) ||
    (claimedGrid !== undefined && anyRectMeeting(claimedGrid.grid, rect, claimedGrid.except));
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
    const b = blockOf(text, capFor(u, o, arrow.labelMaxWidth), measure, lineHeightPx);
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
    let width = Math.max(capFor(u, o, arrow.labelMaxWidth), floor);
    const first = blockOf(text, width, measure, lineHeightPx);
    let chosen: { b: Block; c: Pt } = { b: first, c: place(first, 1) };
    search: for (;;) {
      const b = blockOf(text, width, measure, lineHeightPx);
      for (const sign of [1, -1]) {
        const c = place(b, sign);
        if (!hits(rectAround(c, b.width, b.height))) {
          chosen = { b, c };
          break search;
        }
      }
      const textWidth = b.width - LABEL_PAD_X_PX * 2;
      if (arrow.labelMaxWidth !== undefined || textWidth <= floor + 0.01) break;
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
    const block = fittingBlock(
      text,
      capFor(u, o, arrow.labelMaxWidth),
      u,
      run[1] - run[0],
      measure,
      lineHeightPx,
      arrow.labelMaxWidth !== undefined,
    );
    return block ? { block, run } : null;
  };

  const { span, sc } = placementOf(arrow, route, clear, blockOn);
  const [s0, s1] = openRunOf(span, clear);
  if (s1 <= s0) return beside('empty-run');
  const fit = blockOn(span);
  if (!fit) return beside('no-fit');
  const { block } = fit;
  const step = (s1 - s0) / SLIDE_DIVISIONS;
  const lo = Math.max(s0, sc - (s1 - s0) / 4);
  const hi = Math.min(s1, sc + (s1 - s0) / 4);
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
    if (hits(knockout)) continue;
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
  // Each placed label's rect goes into a grid, so the next asks its neighbourhood, not every label before it.
  const claimed = createRectGrid();
  const ctx: ArrowLabelContext = {
    elements,
    claimed: [],
    claimedGrid: { grid: claimed },
    options: { ...DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS, ...options },
  };
  const out = new Map<ElementId, ArrowLabelLayout>();
  let n = 0;
  for (const el of elements) {
    if (el.type !== 'arrow' || !el.label) continue;
    const l = layoutArrowLabel(el, el.label, ctx);
    if (!l) continue;
    out.set(el.id, l);
    addToRectGrid(claimed, String(n++), l.knockout ?? rectAround(l.center, l.width, l.height));
  }
  return out;
}

// One tab's labels, laid out once and shared by every arrow a renderer
// draws: the layouts, plus the knockout each arrow's line takes.
export type ArrowLabelPass = {
  layouts: ReadonlyMap<ElementId, ArrowLabelLayout>;
  knockoutsOf: (arrowId: ElementId) => Rect[];
};

export function arrowLabelPass(
  elements: Element[],
  options: Partial<ArrowLabelLayoutOptions> = {},
): ArrowLabelPass {
  const layouts = layoutArrowLabels(elements, options);
  // Each labelled arrow's path, and the axis of the run its label sits on, worked out once and only when a line
  // runs under another's label (the editor asks this on every render).
  let index: ElementIndex | null = null;
  const paths = new Map<ElementId, Pt[]>();
  const pathOf = (id: ElementId): Pt[] => {
    let pts = paths.get(id);
    if (!pts) {
      index ??= elementIndexFor(elements);
      const el = index.get(id);
      pts = el?.type === 'arrow' ? arrowPolyline(el, index) : [];
      paths.set(id, pts);
    }
    return pts;
  };
  // The run of `pts` a point lies on, as its axis: level, upright, or neither.
  const runAt = (pts: Pt[], c: Pt): 'level' | 'upright' | null => {
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1]!, pts[k]!];
      const level = Math.abs(a.y - b.y) < 1;
      const upright = Math.abs(a.x - b.x) < 1;
      if (
        level &&
        Math.abs(c.y - a.y) < 1 &&
        c.x >= Math.min(a.x, b.x) &&
        c.x <= Math.max(a.x, b.x)
      )
        return 'level';
      if (
        upright &&
        Math.abs(c.x - a.x) < 1 &&
        c.y >= Math.min(a.y, b.y) &&
        c.y <= Math.max(a.y, b.y)
      )
        return 'upright';
    }
    return null;
  };
  const labelled = [...layouts].filter(([, l]) => l.knockout);
  // The labelled centres in a grid, keyed by their place in `labelled`, built on the first ask: a line asks which
  // centres lie near its own path, not every label (canvas-performance.md "Arrow labels ask their neighbourhood").
  let centres: RectGrid | null = null;
  // The labels whose centre could lie on `pts`, in `labelled` order: those inside its bounds widened past runAt's
  // one-pixel tolerance; every label when the bounds are not finite.
  const near = (pts: Pt[]): (typeof labelled)[number][] => {
    if (pts.length === 0) return [];
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    if (![x0, y0, x1, y1].every(Number.isFinite)) return labelled;
    if (!centres) {
      centres = createRectGrid();
      labelled.forEach(([, l], k) =>
        addToRectGrid(centres!, String(k), { x: l.center.x, y: l.center.y, width: 0, height: 0 }),
      );
    }
    const hits: number[] = [];
    const query = { x: x0 - 2, y: y0 - 2, width: x1 - x0 + 4, height: y1 - y0 + 4 };
    eachRectMeeting(centres, query, new Set(), (k) => hits.push(Number(k)));
    return hits.sort((a, b) => a - b).map((k) => labelled[k]!);
  };
  return {
    layouts,
    // A label cuts its own line, and any other line run along it on the same track (a bus several arrows share),
    // which is the same line to a reader: drawn over the plate, it struck the label through. A line that only
    // crosses a label is drawn as it is (docs/specs/008-canvas/arrow-labels.md).
    knockoutsOf: (id) => {
      const own = layouts.get(id)?.knockout;
      const out = own ? [own] : [];
      for (const [other, l] of near(pathOf(id))) {
        if (other === id) continue;
        const mine = runAt(pathOf(id), l.center);
        if (mine && mine === runAt(pathOf(other), l.center)) out.push(l.knockout!);
      }
      return out;
    },
  };
}
