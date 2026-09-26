// Geometry primitives with no dependencies: the point / rect types and the
// small pure helpers (clamp, overlap and containment tests, unions) that the
// editor, the renderers and the layout passes all share. A leaf on purpose:
// nothing here imports the package barrel, so any module can use it without
// joining an import cycle. Re-exported through geometry.ts.

export type Point = { x: number; y: number };

// An axis-aligned box in canvas units: the shape every boxed element, bounds
// union and hit-test in the editor shares.
export type Rect = { x: number; y: number; width: number; height: number };

// Pin `v` into [lo, hi]. When the range is inverted (lo > hi) `lo` wins, so a
// popover wider than the viewport sits at the leading margin rather than off
// the far edge.
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Do two rects overlap? EXCLUSIVE: rects that only share an edge do not.
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Does `r` hold `p`? INCLUSIVE: a point on the edge counts as inside.
export function pointInRect(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

// Distance from `p` to the segment a-b (not the infinite line through it). A
// degenerate segment (a and b within 1e-9 squared) measures to `a`.
export function distToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  const t =
    lenSq < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

// The smallest rect holding every rect given, or null when there are none.
export function unionRects(rects: Iterable<Rect>): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const r of rects) {
    found = true;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return found ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

// The smallest rect holding every point given, or null when there are none.
export function boundsOfPoints(points: Iterable<Point>): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const p of points) {
    found = true;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return found ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

// Rotate `p` clockwise about `center` by `deg` degrees, matching the
// CSS `transform: rotate(deg)` the canvas applies to a rotated element
// (positive = clockwise in the y-down canvas space). Pure helper shared
// by anchorPosition, the side choice in anchor-choice.ts and the outline
// inside test in shape-outline.ts.
export function rotatePoint(p: Point, center: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}
