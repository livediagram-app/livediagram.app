// Geometry the auto-rebind asks of an arrow's DRAWN path
// (docs/specs/008-canvas/arrow-anchors.md "The trigger", "Crossings on one
// side"): does it run through a shape, and do two paths cross.

import {
  arrowStyleOf,
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Endpoint,
} from './index';
import { arrowPathPolyline } from './arrow-path';
import { endpointPosition, type ElementIndex } from './geometry';
import { rotatePoint, type Point } from './geometry-primitives';
import { anchorOutline, connectorBox, pointInsideLocalOutline } from './shape-outline';

// A path must go more than this deep inside an outline to count as passing
// through it: touching an anchor or running along an edge does not.
export const PATH_INSIDE_INSET_PX = 2;
// Sampling step along a segment clipped to the shape; not coarser than the
// inset, so a path cannot slip between samples deeper than the tolerance.
export const PATH_SAMPLE_STEP_PX = 2;
export const PATH_MAX_SAMPLES_PER_SEGMENT = 512;
// Two paths meeting within this distance of an end point meet, not cross.
export const CROSSING_ENDPOINT_TOLERANCE_PX = 1;

// The arrow as rendered, between its true anchor points (no fan offset).
export function arrowPolyline(arrow: ArrowElement, index: ElementIndex): Point[] {
  const from = endpointPosition(arrow.from, index);
  const to = endpointPosition(arrow.to, index);
  return arrowPathPolyline(
    arrowStyleOf(arrow),
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
}

// Liang-Barsky: the parameter range of a -> b inside the rect, or null.
function clipToRect(
  a: Point,
  b: Point,
  r: { x: number; y: number; width: number; height: number },
): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

// Whether the path goes inside the element's anchoring outline deeper than
// PATH_INSIDE_INSET_PX. Each segment is brought into the element's local
// frame (rotation keeps it straight), clipped to the connector box, and
// sampled only there.
export function pathPassesThrough(path: readonly Point[], el: BoxedElement): boolean {
  const pivot = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const rotation = el.rotation ?? 0;
  const toLocal = (p: Point) => (rotation ? rotatePoint(p, pivot, -rotation) : p);
  const box = connectorBox(el);
  const outline = anchorOutline(el);
  for (let i = 0; i < path.length - 1; i++) {
    const a = toLocal(path[i]!);
    const b = toLocal(path[i + 1]!);
    const range = clipToRect(a, b, box);
    if (!range) continue;
    const [t0, t1] = range;
    const length = Math.hypot(b.x - a.x, b.y - a.y) * (t1 - t0);
    const steps = Math.min(
      PATH_MAX_SAMPLES_PER_SEGMENT,
      Math.max(1, Math.ceil(length / PATH_SAMPLE_STEP_PX)),
    );
    for (let s = 0; s <= steps; s++) {
      const t = t0 + ((t1 - t0) * s) / steps;
      const local = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (pointInsideLocalOutline(el, outline, local, PATH_INSIDE_INSET_PX)) return true;
    }
  }
  return false;
}

// The proper intersection point of two segments, or null (parallel,
// collinear, or touching only at a segment end).
function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a.x + rx * t, y: a.y + ry * t };
}

// Whether two paths cross: a proper intersection away from every path end
// point, so two arrows into one anchor meet rather than cross.
export function pathsCross(p: readonly Point[], q: readonly Point[]): boolean {
  if (p.length < 2 || q.length < 2) return false;
  const ends = [p[0]!, p[p.length - 1]!, q[0]!, q[q.length - 1]!];
  for (let i = 0; i < p.length - 1; i++) {
    for (let j = 0; j < q.length - 1; j++) {
      const hit = segmentIntersection(p[i]!, p[i + 1]!, q[j]!, q[j + 1]!);
      if (!hit) continue;
      const nearEnd = ends.some(
        (e) => Math.hypot(e.x - hit.x, e.y - hit.y) <= CROSSING_ENDPOINT_TOLERANCE_PX,
      );
      if (!nearEnd) return true;
    }
  }
  return false;
}

// The boxed element a pinned end sits on, or null (free, on-arrow, missing,
// or pinned to something without a box).
export function pinnedBoxedElement(ep: Endpoint, index: ElementIndex): BoxedElement | null {
  if (ep.kind !== 'pinned') return null;
  const el = index.get(ep.elementId);
  return el && isBoxed(el) ? el : null;
}

// Whether the arrow's path runs through the shape of either pinned end.
export function passesThroughOwnShapes(
  arrow: ArrowElement,
  path: readonly Point[],
  index: ElementIndex,
): boolean {
  for (const ep of [arrow.from, arrow.to]) {
    const el = pinnedBoxedElement(ep, index);
    if (el && pathPassesThrough(path, el)) return true;
  }
  return false;
}
