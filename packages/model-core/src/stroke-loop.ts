// A marker loop for the Fill tool (livediagram docs/specs/023-draw-mode/fill-tool.md "When ends meet",
// livedesign docs/specs/023-draw-mode/drawing-tools.md "The Fill tool"): whether a single stroke's ends
// meet round something, closing it across its gap, the point-inside test a press makes, and the path
// its fill draws. Pure, in canvas px, read by every product that fills a marker loop.
import type { Point } from './geometry-primitives';

/** A loop has at least this many points: a tap or a dash is not one. */
export const STROKE_LOOP_MIN_POINTS = 4;
/** The gap the ends may leave, at the least, in canvas px (the pencil's close-on-release reach). */
export const STROKE_LOOP_MIN_GAP_PX = 16;
/** ...and at the least this many pen widths, so a thick marker forgives a thicker gap. */
export const STROKE_LOOP_GAP_PEN_WIDTHS = 3;
/** ...and at the least this share of the stroke's longer side, so a big loop forgives a bigger gap. */
export const STROKE_LOOP_GAP_RATIO = 0.15;
/**
 * A loop is at least this round: its area against the area a circle of the same length would hold
 * (4 pi A / P squared, 1 for a circle). A line drawn out and back over itself encloses next to
 * nothing for its length; a long thin oval (10:1) still reads about 0.2.
 */
export const STROKE_LOOP_MIN_ROUNDNESS = 0.1;
// A gap under this (canvas px) is already closed by the ink: no point is added to close it.
const CLOSED_GAP_PX = 0.5;

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function boxOf(pts: readonly Point[]): Box {
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
  return { minX, minY, maxX, maxY };
}

/** The distance between a stroke's first and last points. */
export function strokeLoopGap(pts: readonly Point[]): number {
  if (pts.length < 2) return 0;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The largest gap a stroke this size, drawn this wide, may leave and still be a loop. */
export function strokeLoopTolerance(pts: readonly Point[], penWidth: number): number {
  if (pts.length === 0) return STROKE_LOOP_MIN_GAP_PX;
  const box = boxOf(pts);
  const longer = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  return Math.max(
    STROKE_LOOP_MIN_GAP_PX,
    STROKE_LOOP_GAP_PEN_WIDTHS * penWidth,
    STROKE_LOOP_GAP_RATIO * longer,
  );
}

/** The polyline's length, closed across its gap. */
export function loopPerimeter(pts: readonly Point[]): number {
  let length = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    length += Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y);
  }
  return length;
}

/** The area the polyline encloses, closed across its gap (the shoelace formula, unsigned). */
export function loopArea(pts: readonly Point[]): number {
  let twice = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    twice += (pts[j]!.x + pts[i]!.x) * (pts[j]!.y - pts[i]!.y);
  }
  return Math.abs(twice) / 2;
}

/**
 * Whether a single stroke's ends meet round something (fill-tool.md "When ends meet"): enough
 * points, a gap within the tolerance, and round enough to enclose something. Linear in the points.
 */
export function isStrokeLoop(pts: readonly Point[], penWidth: number): boolean {
  if (pts.length < STROKE_LOOP_MIN_POINTS) return false;
  if (strokeLoopGap(pts) > strokeLoopTolerance(pts, penWidth)) return false;
  const perimeter = loopPerimeter(pts);
  return perimeter > 0 && (4 * Math.PI * loopArea(pts)) / perimeter ** 2 >= STROKE_LOOP_MIN_ROUNDNESS;
}

/**
 * The stroke closed across its gap: its first point added at its end (with the last pressure), so
 * the ink itself closes the outline. Unchanged when the ends already touch.
 */
export function closeStrokeLoop(
  pts: readonly Point[],
  pressures?: ArrayLike<number> | null,
): { points: Point[]; pressures?: number[] } {
  const points = pts.map((p) => ({ x: p.x, y: p.y }));
  const kept = pressures ? Array.from(pressures).slice(0, points.length) : undefined;
  if (points.length >= 2 && strokeLoopGap(points) > CLOSED_GAP_PX) {
    points.push({ ...points[0]! });
    if (kept) kept.push(kept[kept.length - 1]!);
  }
  return kept ? { points, pressures: kept } : { points };
}

/** Even-odd: whether `p` lies inside the polyline, closed across its gap. */
export function insideLoop(p: Point, pts: readonly Point[]): boolean {
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

/** Whether `p` lies inside the box of the points, grown by `pad`: the cheap test before any other. */
export function inPointsBox(p: Point, pts: readonly Point[], pad = 0): boolean {
  if (pts.length === 0) return false;
  const box = boxOf(pts);
  return p.x >= box.minX - pad && p.x <= box.maxX + pad && p.y >= box.minY - pad && p.y <= box.maxY + pad;
}

/** The fill a closed stroke draws under its ink: a closed polygon through its centre line. */
export function loopFillPath(pts: readonly Point[], fmt: (n: number) => number = (n) => n): string {
  if (pts.length < 3) return '';
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p.x)} ${fmt(p.y)}`).join(' ')} Z`;
}
