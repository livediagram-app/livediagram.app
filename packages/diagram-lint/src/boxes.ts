// What the lint calls a box, and the exact geometry it judges boxes by (blueprint "The checks", LN2,
// LN3): oriented rects, so a rotated box is measured as drawn.

import {
  isBoxed,
  isContainer,
  rotatePoint,
  type BoxedElement,
  type Element,
  type Point,
  type Rect,
} from '@livediagram/document';
import { LINT_OVERLAP_TOLERANCE_PX } from './constants';

const NOT_BOXES: ReadonlySet<string> = new Set(['text', 'annotation', 'freehand', 'path']);

const finite = (el: BoxedElement) =>
  [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v));

// A boxed element that is not a container, text, annotation, stroke or path, with a usable rect (LN2).
export function isLintBox(el: Element): el is BoxedElement {
  return isBoxed(el) && !isContainer(el) && !NOT_BOXES.has(el.type) && finite(el);
}

export const centreOf = (el: Rect): Point => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// The four corners as drawn, rotation included, clockwise from the top left.
export function boxCorners(el: BoxedElement): Point[] {
  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height },
  ];
  const rotation = el.rotation ?? 0;
  return rotation ? corners.map((p) => rotatePoint(p, centreOf(el), rotation)) : corners;
}

// The axis-aligned bounds of the box as drawn.
export function boxBounds(el: BoxedElement): Rect {
  const corners = boxCorners(el);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

// The edge normals of a rect drawn by its corners.
function axesOf(corners: readonly Point[]): Point[] {
  return [0, 1].map((i) => {
    const a = corners[i]!;
    const b = corners[i + 1]!;
    return { x: -(b.y - a.y), y: b.x - a.x };
  });
}

function project(corners: readonly Point[], axis: Point): [number, number] {
  const length = Math.hypot(axis.x, axis.y);
  const values = corners.map((p) => (p.x * axis.x + p.y * axis.y) / length);
  return [Math.min(...values), Math.max(...values)];
}

// How deep two boxes press into each other: the smallest overlap of their projections over the four
// edge normals (separating axes). Zero or less means they are apart or only touch.
export function overlapDepth(a: BoxedElement, b: BoxedElement): number {
  const ca = boxCorners(a);
  const cb = boxCorners(b);
  let depth = Infinity;
  for (const axis of [...axesOf(ca), ...axesOf(cb)]) {
    const [minA, maxA] = project(ca, axis);
    const [minB, maxB] = project(cb, axis);
    depth = Math.min(depth, Math.min(maxA, maxB) - Math.max(minA, minB));
  }
  return depth;
}

// Whether a point lies in the box as drawn, grown by `tolerance` on every side.
function holdsPoint(box: BoxedElement, p: Point, tolerance: number): boolean {
  const rotation = box.rotation ?? 0;
  const local = rotation ? rotatePoint(p, centreOf(box), -rotation) : p;
  return (
    local.x >= box.x - tolerance &&
    local.x <= box.x + box.width + tolerance &&
    local.y >= box.y - tolerance &&
    local.y <= box.y + box.height + tolerance
  );
}

// One box wholly inside the other, either way round: an icon on a square is not an overlap (N12).
export function holdsWholly(a: BoxedElement, b: BoxedElement): boolean {
  const inside = (outer: BoxedElement, inner: BoxedElement) =>
    boxCorners(inner).every((p) => holdsPoint(outer, p, LINT_OVERLAP_TOLERANCE_PX));
  return inside(a, b) || inside(b, a);
}
