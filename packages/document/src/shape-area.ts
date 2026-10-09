// The area a shape covers, as closed rings (docs/specs/007-editor/logo-pages.md "Combine"): what
// combining shapes works on. Unlike the hit outline (shape-hit.ts), which traces the border's
// centre line, this is the whole drawn area out to the box's edge, its curves traced finely enough
// that no ring strays more than `tolerance` px from the shape. In the element's local, unrotated px.
import { cornerRadiusPx } from './border-style';
import type { Point } from './geometry-primitives';
import type { ShapeElement } from './index';
import { SHAPE_GEOMETRY_KINDS, shapeGeometry } from './shape-geometry';
import {
  CSS_DEFAULT_RADIUS_PX,
  ellipseRing,
  FILLED_ROLES,
  partLines,
  roundedRectRing,
  type OutlineSegments,
} from './shape-hit';
import type { ShapeKind } from './shape-kind';
import { boxFit } from './svg-shape-fit';

// The CSS-drawn kinds whose area is their (rounded) box.
const AREA_BOX_KINDS: ReadonlySet<ShapeKind> = new Set<ShapeKind>(['square', 'circle', 'stadium']);
// The drawn kinds a mark can be made of: the table's silhouettes, less the ones that are scenes of
// several pieces (devices, the actor) rather than one outline.
const NOT_A_SILHOUETTE: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'actor',
  'monitor',
  'laptop',
  'phone',
  'tablet',
  'foldable',
  'smartwatch',
]);
const AREA_DRAWN_KINDS: ReadonlySet<ShapeKind> = new Set(
  SHAPE_GEOMETRY_KINDS.filter((k) => !NOT_A_SILHOUETTE.has(k)),
);

/** Whether a shape of this kind has an area to combine. */
export function hasShapeArea(kind: ShapeKind): boolean {
  return AREA_BOX_KINDS.has(kind) || AREA_DRAWN_KINDS.has(kind);
}

/** How many points a whole turn of radius `r` needs to stay within `tolerance` of the circle (a
 *  chord's sagitta r(1 - cos(θ/2)) ≈ rθ²/8), and a cubic the same share of it. */
export function outlineSegments(r: number, tolerance: number): OutlineSegments {
  const step = Math.sqrt((8 * tolerance) / Math.max(r, tolerance));
  const turn = Math.max(16, Math.ceil((2 * Math.PI) / step / 4) * 4);
  return { turn, curve: Math.max(12, Math.ceil(turn / 4)) };
}

/** The shape's area as closed rings, or null for a kind with no area to combine. */
export function shapeAreaContours(el: ShapeElement, tolerance = 0.25): Point[][] | null {
  const w = el.width;
  const h = el.height;
  if (!(w > 0 && h > 0) || !hasShapeArea(el.shape)) return null;
  const seg = outlineSegments(Math.max(w, h) / 2, tolerance);
  if (el.shape === 'circle') return [ellipseRing(w / 2, h / 2, w / 2, h / 2, seg.turn)];
  if (AREA_BOX_KINDS.has(el.shape)) {
    const r =
      el.shape === 'stadium'
        ? Math.min(w, h) / 2
        : cornerRadiusPx(el.borderRadius, w, h, CSS_DEFAULT_RADIUS_PX);
    return [roundedRectRing(0, 0, w, h, r, r, outlineSegments(r, tolerance).turn / 4)];
  }
  const geometry = shapeGeometry(el.shape, w / h);
  if (!geometry) return null;
  const fit = boxFit(geometry, { x: 0, y: 0, width: w, height: h });
  const place = (p: Point): Point => ({ x: fit.ox + p.x * fit.sx, y: fit.oy + p.y * fit.sy });
  const rings: Point[][] = [];
  for (const part of geometry.parts) {
    if (!FILLED_ROLES.has(part.role)) continue;
    for (const line of partLines(part, seg)) {
      if (line.closed && line.points.length >= 3) rings.push(line.points.map(place));
    }
  }
  return rings.length > 0 ? rings : null;
}
