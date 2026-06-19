// Isometric view (spec/45): pure projection constants + helpers for the
// navigation-only isometric canvas tool. Kept out of Canvas.tsx so the
// geometry is unit-testable and the canvas just consumes the values.

import type { ShapeKind } from '@livediagram/diagram';

// CSS silhouette for a shape's isometric extrusion. Each depth layer is a box
// filling the element rect; left as a plain rectangle the extrusion of a
// circle / diamond / cylinder reads as a square block behind the shape (the
// reported bug). Clipping every layer to the shape's own outline makes the
// column follow the silhouette instead. The polygon points are lifted straight
// from ShapeSvgOverlay's `0 0 100 100` viewBox (which equals CSS percentages),
// so the extrusion and the painted shape share one geometry source. Shapes
// without an entry (square, browser, document, cloud, devices, text / sticky /
// image / table …) fall back to the default rounded rectangle.
//
// `radius` shapes use border-radius rather than a polygon because their outline
// is curved: circle / progress-ring are full ellipses, stadium is a pill, and
// cylinder gets elliptical top + bottom caps (`50% / 12%` matches the SVG's
// ry=12 in the 0..100 box) with straight sides.
const SHAPE_CLIP_PATH: Partial<Record<ShapeKind, string>> = {
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  parallelogram: 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  triangle: 'polygon(50% 2%, 98% 98%, 2% 98%)',
  trapezoid: 'polygon(22% 4%, 78% 4%, 98% 96%, 2% 96%)',
  star: 'polygon(50% 2%, 61% 35%, 96% 35%, 68% 56%, 78% 89%, 50% 69%, 22% 89%, 32% 56%, 4% 35%, 39% 35%)',
};

const SHAPE_BORDER_RADIUS: Partial<Record<ShapeKind, string>> = {
  circle: '50%',
  'progress-ring': '50%',
  stadium: '9999px',
  cylinder: '50% / 12%',
};

export function isoShapeSilhouette(shape: ShapeKind): {
  clipPath?: string;
  borderRadius?: string;
} {
  return { clipPath: SHAPE_CLIP_PATH[shape], borderRadius: SHAPE_BORDER_RADIUS[shape] };
}

// Default isometric camera angles (degrees). `z` is the azimuth (rotateZ,
// spin around the vertical), `x` the elevation (rotateX, tilt away from the
// viewer). These seed the adjustable camera (useIsometricCamera): the view
// opens here and the user can orbit from it (Shift-drag).
export const ISO_TILT_DEG = { x: 55, z: -45 } as const;

// Elevation (rotateX) clamp. Below ~15deg the plane is nearly edge-on and the
// content all but vanishes; above ~85deg it flattens back toward the plain 2D
// top-down view, so the orbit stops short of both extremes.
export const ISO_ELEVATION_RANGE = { min: 15, max: 85 } as const;

export function clampElevation(deg: number): number {
  return Math.max(ISO_ELEVATION_RANGE.min, Math.min(ISO_ELEVATION_RANGE.max, deg));
}

// The CSS transform fragment for a given camera. It is placed INNERMOST in
// the wrapper transform (i.e. AFTER scale()/translate() in the CSS list, so
// it applies to the content first). That keeps the pan translate in screen
// space, so drag-to-pan moves the scene the way the cursor moves at ANY
// camera angle — only the content is tilted, never the pan vector. No
// `perspective`: isometric is parallel projection, so there is deliberately
// no vanishing point.
//
// `pivot` (canvas px, relative to the wrapper centre — see isoPivot) makes
// the tilt rotate AROUND the content's own centre instead of the wrapper
// centre. Without it the rotation pivots about the wrapper centre, so any
// diagram whose centre sits away from that point swings off-screen the
// instant the view tilts (and again as you orbit). Wrapping the rotation in
// translate(pivot) … translate(-pivot) pins the content centre in place; the
// translates stay INSIDE this fragment, so the pan offset (outside it) is
// still applied in screen space.
export function isoTransform(
  azimuthDeg: number,
  elevationDeg: number,
  pivot?: { x: number; y: number },
): string {
  const rot = `rotateX(${elevationDeg}deg) rotateZ(${azimuthDeg}deg)`;
  if (!pivot) return rot;
  return `translate(${pivot.x}px, ${pivot.y}px) ${rot} translate(${-pivot.x}px, ${-pivot.y}px)`;
}

// The 2D affine matrix equivalent of `isoTransform` for a flat (z=0) plane,
// used by the image export (spec/48 isometric export). Isometric is a parallel
// (orthographic) projection with no perspective, so projecting the diagram
// plane under `rotateX(elevation) rotateZ(azimuth)` collapses to a plain 2x2
// affine map: an in-plane rotation by the azimuth, then a vertical squash by
// cos(elevation) (the tilt's foreshortening). Returned in canvas
// `transform(a,b,c,d,e,f)` order (e/f are the caller's translation), so a
// point (x,y) maps to (a·x + c·y, b·x + d·y). Defaults to the on-screen camera
// so the export matches the editor's isometric view.
export function isoCanvasMatrix(
  azimuthDeg: number = ISO_TILT_DEG.z,
  elevationDeg: number = ISO_TILT_DEG.x,
): { a: number; b: number; c: number; d: number } {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const cosE = Math.cos(e);
  return { a: cosA, b: cosE * sinA, c: -sinA, d: cosE * cosA };
}

// Project a rectangle through `isoCanvasMatrix`, returning the axis-aligned
// bounding box of the result (its four mapped corners). Used to size the
// export canvas / SVG viewBox so the tilted scene isn't clipped.
export function isoProjectBounds(
  rect: { x: number; y: number; w: number; h: number },
  m: { a: number; b: number; c: number; d: number },
): { x: number; y: number; w: number; h: number } {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h },
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const c of corners) {
    const px = m.a * c.x + m.c * c.y;
    const py = m.b * c.x + m.d * c.y;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// The rotation pivot (canvas px) for isoTransform: the content's centre
// expressed relative to the wrapper centre, since the wrapper's
// transform-origin is its centre (`origin-center`). `viewport` is the
// wrapper's unscaled size (the main canvas rect). Returns null when there's
// no content to centre on, so the caller falls back to the plain rotation.
export function isoPivot(
  contentCenter: { x: number; y: number } | null,
  viewport: { width: number; height: number },
): { x: number; y: number } | null {
  if (!contentCenter) return null;
  return { x: contentCenter.x - viewport.width / 2, y: contentCenter.y - viewport.height / 2 };
}

// Extrusion depth, in canvas px, that every boxed element rises off the
// floor in the isometric view. Rendered as a stack of translateZ-offset
// copies (a "voxel" column) rather than four rotated wall faces, so the side
// walls are deterministic — there is no per-wall rotateX/Y that could
// mis-orient (point up instead of down) and nothing to get wrong by sign.
export const ISO_DEPTH_PX = 30;
export const ISO_LAYER_STEP_PX = 2;

// The translateZ offsets (all negative — below the z=0 plane the real element
// sits on) for one element's extrusion stack, front (just under the element)
// to back (the floor). Consecutive 2px-spaced rectangle copies read as a
// solid side wall once tilted; the real element caps the column at z=0.
export function isoDepthLayers(
  depthPx: number = ISO_DEPTH_PX,
  stepPx: number = ISO_LAYER_STEP_PX,
): number[] {
  const layers: number[] = [];
  for (let z = stepPx; z <= depthPx; z += stepPx) layers.push(-z);
  return layers;
}

// Per-layer brightness for the extruded side wall. The wall paints in the
// element's OWN colour (its accent), and this dims it from full near the
// element down to half at the floor, so the side reads as a shaded version
// of the element's colour rather than a flat black slab. Applied as a CSS
// `filter: brightness()`, so it works for any colour without parsing it.
// `index` is the layer position (0 = topmost), `count` the total.
export function isoLayerBrightness(index: number, count: number): number {
  const t = count > 1 ? index / (count - 1) : 0;
  return 1 - 0.5 * t; // 1.0 (just under the element) -> 0.5 (floor)
}
