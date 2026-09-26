// Anchoring outlines (docs/specs/008-canvas/arrow-anchors.md "Anchor
// geometry"): the outline a connector meets on a shape whose drawn edge
// differs from its box, and the inside test the auto-rebind's trigger uses.
// Both read the same outline so an anchor always sits exactly on the edge
// the trigger measures against.

import { isTechIconId } from '@livediagram/icons';
import type { BoxedElement } from './index';
import { techIconMarkBounds } from './icon-size';
import { distToSegment, rotatePoint, type Point } from './geometry-primitives';
import { ACTOR_HULL, ACTOR_VIEWBOX, shapePathData, shapePolygonVertices } from './shape-geometry';
import { sampleSvgPath } from './svg-path-outline';
import type { ShapeKind } from './shape-kind';

// Half circles (a stadium's ends) and half ellipses (a cylinder's caps) are
// polygonised with this many segments each: under half a pixel of error at
// 200 px.
export const ARC_SEGMENTS = 16;

export type AnchorOutline =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'polygon'; points: readonly Point[] };

// The box connectors treat as an element's visual body: a Technology icon's
// fixed-size mark (docs/specs/010-palette/technology-icons.md: the element
// box can be much larger than the visible chip), the element itself
// otherwise. Returns the element identity for the common case so callers can
// cheaply tell the two apart.
export function connectorBox(el: BoxedElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (el.type === 'shape' && el.shape === 'icon' && isTechIconId(el.iconId)) {
    return techIconMarkBounds(el);
  }
  return el;
}

// Shapes drawn as one polygon in the shared geometry table, 0..100 box.
const POLYGON_KINDS: readonly ShapeKind[] = [
  'diamond',
  'parallelogram',
  'hexagon',
  'triangle',
  'trapezoid',
];
// Shapes drawn as one curved path, sampled into a polygon (0..100 box).
const PATH_KINDS: readonly ShapeKind[] = ['cloud', 'document'];
const POLYGONS: Partial<Record<ShapeKind, readonly [number, number][]>> = Object.fromEntries([
  ...POLYGON_KINDS.map((kind) => [kind, shapePolygonVertices(kind)!]),
  ...PATH_KINDS.flatMap((kind) => {
    const points = sampleSvgPath(shapePathData(kind) ?? '');
    return points ? [[kind, points.map((p) => [p.x, p.y])]] : [];
  }),
]);

function stadiumOutline(x: number, y: number, w: number, h: number): Point[] {
  const r = Math.min(w, h) / 2;
  const points: Point[] = [];
  // Two half circles joined by the straight sides, clockwise.
  const arc = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const a = from + (Math.PI * i) / ARC_SEGMENTS;
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  if (w >= h) {
    arc(x + w - r, y + r, -Math.PI / 2);
    arc(x + r, y + r, Math.PI / 2);
  } else {
    arc(x + r, y + h - r, 0);
    arc(x + r, y + r, Math.PI);
  }
  return points;
}

// The cylinder as drawn (shape-geometry.ts): a body from y 15 to 85 of its
// 0..100 box, capped by half ellipses (ry 12) bulging up at the top and down
// at the bottom.
function cylinderOutline(x: number, y: number, w: number, h: number): Point[] {
  const points: Point[] = [];
  const at = (vx: number, vy: number) =>
    points.push({ x: x + (vx / 100) * w, y: y + (vy / 100) * h });
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = Math.PI + (Math.PI * i) / ARC_SEGMENTS;
    at(50 + 50 * Math.cos(a), 15 + 12 * Math.sin(a));
  }
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = (Math.PI * i) / ARC_SEGMENTS;
    at(50 + 50 * Math.cos(a), 85 + 12 * Math.sin(a));
  }
  return points;
}

function actorOutline(x: number, y: number, w: number, h: number): Point[] {
  // Fitted like the drawing: preserveAspectRatio "xMidYMid meet".
  const k = Math.min(w / ACTOR_VIEWBOX.width, h / ACTOR_VIEWBOX.height);
  const ox = x + (w - ACTOR_VIEWBOX.width * k) / 2;
  const oy = y + (h - ACTOR_VIEWBOX.height * k) / 2;
  return ACTOR_HULL.map(([vx, vy]) => ({ x: ox + vx * k, y: oy + vy * k }));
}

// The element's anchoring outline in its local (unrotated) px, or null when
// its connector box is the outline.
export function anchorOutline(el: BoxedElement): AnchorOutline | null {
  if (el.type !== 'shape' || connectorBox(el) !== el) return null;
  const { x, y, width: w, height: h } = el;
  if (w <= 0 || h <= 0) return null;
  if (el.shape === 'circle') {
    return { kind: 'ellipse', cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 };
  }
  if (el.shape === 'stadium') return { kind: 'polygon', points: stadiumOutline(x, y, w, h) };
  if (el.shape === 'actor') return { kind: 'polygon', points: actorOutline(x, y, w, h) };
  if (el.shape === 'cylinder') return { kind: 'polygon', points: cylinderOutline(x, y, w, h) };
  const poly = POLYGONS[el.shape];
  if (!poly) return null;
  return {
    kind: 'polygon',
    points: poly.map(([vx, vy]) => ({ x: x + (vx / 100) * w, y: y + (vy / 100) * h })),
  };
}

// Where the ray from `centre` through `p` first crosses the outline, or null
// when it never does (a degenerate direction).
export function projectOntoOutline(outline: AnchorOutline, centre: Point, p: Point): Point | null {
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  if (outline.kind === 'ellipse') {
    const t =
      1 /
      Math.sqrt(((p.x - outline.cx) / outline.rx) ** 2 + ((p.y - outline.cy) / outline.ry) ** 2);
    return { x: outline.cx + (p.x - outline.cx) * t, y: outline.cy + (p.y - outline.cy) * t };
  }
  const verts = outline.points;
  let bestT = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue; // ray parallel to this edge
    const rx = a.x - centre.x;
    const ry = a.y - centre.y;
    const t = (ex * ry - rx * ey) / det;
    const s = (dx * ry - rx * dy) / det;
    if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && t < bestT) bestT = t;
  }
  if (!Number.isFinite(bestT)) return null;
  return { x: centre.x + dx * bestT, y: centre.y + dy * bestT };
}

// Even-odd containment for a simple polygon.
function insidePolygon(points: readonly Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

// Whether `p` (world coordinates) lies inside the element's anchoring
// outline by more than `inset` px. Rotation is undone about the element
// centre first, the same pivot anchorPosition rotates about.
export function pointInsideOutline(el: BoxedElement, p: Point, inset: number): boolean {
  const local = el.rotation
    ? rotatePoint(p, { x: el.x + el.width / 2, y: el.y + el.height / 2 }, -el.rotation)
    : p;
  return pointInsideLocalOutline(el, anchorOutline(el), local, inset);
}

// The same test for a point already in the element's local (unrotated)
// frame, with the outline computed once by the caller (a path samples many
// points against one outline).
export function pointInsideLocalOutline(
  el: BoxedElement,
  outline: AnchorOutline | null,
  local: Point,
  inset: number,
): boolean {
  if (!outline) {
    const box = connectorBox(el);
    return (
      local.x > box.x + inset &&
      local.x < box.x + box.width - inset &&
      local.y > box.y + inset &&
      local.y < box.y + box.height - inset
    );
  }
  if (outline.kind === 'ellipse') {
    const rx = outline.rx - inset;
    const ry = outline.ry - inset;
    if (rx <= 0 || ry <= 0) return false;
    return ((local.x - outline.cx) / rx) ** 2 + ((local.y - outline.cy) / ry) ** 2 < 1;
  }
  const pts = outline.points;
  if (!insidePolygon(pts, local)) return false;
  for (let i = 0; i < pts.length; i++) {
    if (distToSegment(local, pts[i]!, pts[(i + 1) % pts.length]!) <= inset) return false;
  }
  return true;
}
