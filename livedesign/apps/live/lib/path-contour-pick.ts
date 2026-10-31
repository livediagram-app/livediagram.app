// Which contour of a combined path a press means (docs/specs/023-draw-mode/path-tool.md "Combined
// paths"): the one whose outline is nearest, or the innermost one the press is inside. Pure; one
// pass over the path's segments, so linear in its nodes.
import { pathAnchors, pathContours, samplePath, type PathElement } from '@livedesign/design';
import { toLocal } from './path-edit';

type Point = { x: number; y: number };

// Steps a curve is cut into (a straight segment is one): close enough to pick by.
const CURVE_STEPS = 8;

// How far `p` is from the polyline (closed: back to its start).
function distance(p: Point, line: readonly Point[], closed: boolean): number {
  let best = Infinity;
  const n = line.length;
  for (let i = closed ? 0 : 1; i < n; i++) {
    const a = line[(i - 1 + n) % n]!;
    const b = line[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

// Whether `p` is inside the closed polyline (even-odd ray cast).
function inside(p: Point, ring: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

// The polyline's area (shoelace), for "innermost".
function area(ring: readonly Point[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j]!.x + ring[i]!.x) * (ring[j]!.y - ring[i]!.y);
  }
  return Math.abs(s) / 2;
}

/**
 * The contour a press at `world` (canvas px) means: the one whose outline is within `radius` and
 * nearest, else the innermost one it is inside; null for neither. `nearestAnyway` takes the nearest
 * outline however far, as opening edit mode does.
 */
export function contourAt(
  el: PathElement,
  world: Point,
  radius: number,
  nearestAnyway = false,
): number | null {
  const p = toLocal(el, world);
  const lines = pathContours(el).map((nodes) =>
    samplePath(pathAnchors({ ...el, nodes }), el.closed, CURVE_STEPS),
  );
  let near: number | null = null;
  let nearD = Infinity;
  lines.forEach((line, i) => {
    const d = distance(p, line, el.closed);
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  });
  if (near !== null && (nearestAnyway || nearD <= radius)) return near;
  if (!el.closed) return null;
  let innermost: number | null = null;
  let smallest = Infinity;
  lines.forEach((ring, i) => {
    if (!inside(p, ring)) return;
    const a = area(ring);
    if (a < smallest) {
      smallest = a;
      innermost = i;
    }
  });
  return innermost;
}
