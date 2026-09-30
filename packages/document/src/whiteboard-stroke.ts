// Stroke geometry for the whiteboard eraser (docs/specs/023-whiteboard/whiteboard.md "Eraser"): whether a
// brush swept along a segment touches a stroke's INK (not its bounding box),
// and the pieces of a stroke that survive a Partial erase. Pure; canvas coords.
import { BORDER_STROKE_PX, DEFAULT_BORDER_STROKE } from './border-style';
import { createFreehand } from './factories';
import { PEN_MID_PRESSURE, penPressureWidth } from './pen-stroke';
import type { FreehandElement, PathElement } from './index';
import { pathWorldAnchors } from './path-element';
import { samplePath } from './path-geometry';

type Point = { x: number; y: number };
// A point of a pen stroke with its pressure, when the stroke records one.
type InkPoint = Point & { p?: number };

// Two ink points' blend at `t` (0: `a`), pressure included when both carry one.
function lerpInk(a: InkPoint, b: InkPoint, t: number): InkPoint {
  const q: InkPoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  if (a.p !== undefined && b.p !== undefined) q.p = a.p + (b.p - a.p) * t;
  return q;
}

// How many halvings locate the edge of the brush on a cut segment.
const CROSSING_BISECTION_STEPS = 12;
// Pieces shorter than this (canvas px) are specks, not ink worth keeping.
const MIN_PIECE_LENGTH = 1;
const HIGHLIGHTER_DEFAULT_WIDTH = 14;

// Fields every piece of a split stroke keeps: how the ink looks and where it lives.
const STYLE_FIELDS = [
  'strokeColor',
  'fillColor',
  'strokeWidth',
  'strokeStyle',
  'penWidth',
  'pen',
  'streamline',
  'penColour',
  'layerId',
  'opacity',
  'animation',
  'animationSpeed',
  'animationRepeat',
] as const satisfies readonly (keyof FreehandElement)[];

// Fields only one piece can carry, so they go with the longest.
const ANNOTATION_FIELDS = [
  'label',
  'textSize',
  'textAlignX',
  'textAlignY',
  'textBold',
  'textItalic',
  'textUnderline',
  'textStrikethrough',
  'font',
  'textColor',
  'link',
  'commentThread',
  'action',
  'note',
  'noteRich',
] as const satisfies readonly (keyof FreehandElement)[];

/** The stroke's polyline in canvas coords, with any rotation baked in. */
export function freehandAbsolutePoints(el: FreehandElement): Point[] {
  const pts = el.points.map((p) => ({ x: el.x + p.nx * el.width, y: el.y + p.ny * el.height }));
  const deg = el.rotation ?? 0;
  if (deg % 360 === 0) return pts;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return pts.map((p) => ({
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
  }));
}

function inkHalfWidth(el: FreehandElement): number {
  if (el.pen === 'highlighter') return (el.penWidth ?? HIGHLIGHTER_DEFAULT_WIDTH) / 2;
  if (el.penWidth === undefined)
    return BORDER_STROKE_PX[el.strokeWidth ?? DEFAULT_BORDER_STROKE] / 2;
  // A pen stroke is widest where it was pressed hardest.
  const hardest = el.pressures?.length ? Math.max(...el.pressures) : PEN_MID_PRESSURE;
  return penPressureWidth(el.penWidth, hardest) / 2;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** The shortest distance between segments `p1 p2` and `q1 q2`: 0 when they cross. */
export function segmentDistance(p1: Point, p2: Point, q1: Point, q2: Point): number {
  if (segmentsIntersect(p1, p2, q1, q2)) return 0;
  return Math.min(
    distToSegment(p1, q1, q2),
    distToSegment(p2, q1, q2),
    distToSegment(q1, p1, p2),
    distToSegment(q2, p1, p2),
  );
}

function boxesApart(pts: Point[], a: Point, b: Point, reach: number): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return (
    Math.max(a.x, b.x) + reach < minX ||
    Math.min(a.x, b.x) - reach > maxX ||
    Math.max(a.y, b.y) + reach < minY ||
    Math.min(a.y, b.y) - reach > maxY
  );
}

/** True when a brush of radius `r` swept from `a` to `b` touches the stroke's ink. */
export function strokeTouchesBrush(el: FreehandElement, a: Point, b: Point, r: number): boolean {
  const pts = freehandAbsolutePoints(el);
  const reach = r + inkHalfWidth(el);
  if (pts.length === 0 || boxesApart(pts, a, b, reach)) return false;
  if (pts.length === 1) return distToSegment(pts[0]!, a, b) <= reach;
  for (let i = 1; i < pts.length; i++) {
    if (segmentDistance(pts[i - 1]!, pts[i]!, a, b) <= reach) return true;
  }
  return false;
}

/** Even-odd: whether `p` lies inside the closed polyline. */
export function insidePolygon(p: Point, pts: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * True when a brush swept from `a` to `b` touches a path (docs/specs/023-whiteboard/path-tool.md
 * "Selecting and erasing"): its drawn line, and the inside of a closed path with a fill.
 */
export function pathTouchesBrush(el: PathElement, a: Point, b: Point, r: number): boolean {
  const pts = samplePath(pathWorldAnchors(el), el.closed);
  const reach = r + BORDER_STROKE_PX[el.strokeWidth ?? DEFAULT_BORDER_STROKE] / 2;
  if (pts.length === 0 || boxesApart(pts, a, b, reach)) return false;
  for (let i = 1; i < pts.length; i++) {
    if (segmentDistance(pts[i - 1]!, pts[i]!, a, b) <= reach) return true;
  }
  const filled = el.closed && el.fillColor !== undefined && el.fillColor !== 'transparent';
  return filled && (insidePolygon(a, pts) || insidePolygon(b, pts));
}

// Cut long segments so the brush cannot slip between two samples.
function densify(pts: InkPoint[], step: number): InkPoint[] {
  const out: InkPoint[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const from = pts[i - 1]!;
    const to = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    for (let k = 1; k <= n; k++) {
      out.push(lerpInk(from, to, k / n));
    }
  }
  return out;
}

// The point on `out -> in` where the brush's edge lies.
function crossing(outside: InkPoint, inside: InkPoint, isInside: (p: Point) => boolean): InkPoint {
  let lo = outside;
  let hi = inside;
  for (let i = 0; i < CROSSING_BISECTION_STEPS; i++) {
    const mid = lerpInk(lo, hi, 0.5);
    if (isInside(mid)) hi = mid;
    else lo = mid;
  }
  return lo;
}

function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return len;
}

function pickFields<K extends keyof FreehandElement>(
  el: FreehandElement,
  keys: readonly K[],
): Partial<FreehandElement> {
  const out: Partial<FreehandElement> = {};
  for (const k of keys) if (el[k] !== undefined) out[k] = el[k];
  return out;
}

/**
 * Partial erase: the pieces of `el` that survive a brush of radius `r` swept
 * from `a` to `b`. `null` when the brush misses the ink, `[]` when it takes all
 * of it. Pieces are open strokes with fresh ids.
 */
export function eraseStrokePart(
  el: FreehandElement,
  a: Point,
  b: Point,
  r: number,
  mintId: () => string,
): FreehandElement[] | null {
  const pressures = el.pressures?.length === el.points.length ? el.pressures : undefined;
  const raw: InkPoint[] = freehandAbsolutePoints(el).map((q, i) =>
    pressures ? { ...q, p: pressures[i]! } : q,
  );
  if (raw.length === 0) return null;
  const reach = r + inkHalfWidth(el);
  if (boxesApart(raw, a, b, reach)) return null;
  const isInside = (p: Point) => distToSegment(p, a, b) <= reach;
  const closedPath = el.closed && raw.length > 2 ? [...raw, raw[0]!] : raw;
  const pts = densify(closedPath, Math.max(r / 2, 1));
  const inside = pts.map(isInside);
  if (!inside.some(Boolean)) return null;
  if (inside.every(Boolean)) return [];

  const runs: InkPoint[][] = [];
  let run: InkPoint[] | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (!inside[i]) {
      if (!run) {
        run = i > 0 ? [crossing(p, pts[i - 1]!, isInside), p] : [p];
      } else {
        run.push(p);
      }
    } else if (run) {
      run.push(crossing(pts[i - 1]!, p, isInside));
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);

  // A closed stroke's first and last runs are one piece that wraps round the start.
  if (el.closed && runs.length > 1 && !inside[0] && !inside[pts.length - 1]) {
    const last = runs.pop()!;
    runs[0] = [...last, ...runs[0]!.slice(1)];
  }

  const kept = runs.filter((p) => p.length >= 2 && polylineLength(p) >= MIN_PIECE_LENGTH);
  if (kept.length === 0) return [];
  let longest = 0;
  kept.forEach((p, i) => {
    if (polylineLength(p) > polylineLength(kept[longest]!)) longest = i;
  });
  const style = pickFields(el, STYLE_FIELDS);
  const annotations = pickFields(el, ANNOTATION_FIELDS);
  return kept.map((points, i) => ({
    ...createFreehand(points, false),
    ...(pressures ? { pressures: points.map((q) => q.p ?? PEN_MID_PRESSURE) } : {}),
    ...style,
    ...(i === longest ? annotations : {}),
    id: mintId(),
  }));
}
