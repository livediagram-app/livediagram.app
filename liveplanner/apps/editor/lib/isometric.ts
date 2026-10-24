// Isometric export (docs/specs/008-canvas/isometric-view.md): pure projection constants + helpers for the image
// export's isometric option, kept apart so the geometry is unit-testable.

import type { BoxedElement } from '@liveplanner/project';

// Whether a boxed element gets an extrusion column in the isometric export
// (docs/specs/008-canvas/isometric-view.md). One predicate shared by both exporters so they can't drift:
// - Frames are section BACKDROPS, not solid blocks — extruding one raises a
//   huge column of near-coplanar slabs under everything inside it (z-fights
//   while the camera orbits). They stay flat on the floor plane.
// - Plain text has no body: extruding it would conjure a slab behind bare
//   words.
// - Icon shapes (line-art glyphs AND Technology / infra marks) read as flat
//   markers, like text: a raised slab under a glyph turns every icon into an
//   anonymous block and buries the artwork.
export function isoExtrudes(el: BoxedElement): boolean {
  if (el.type === 'text') return false;
  // A sticker is a flat thing stuck ON the canvas (docs/specs/010-palette/stickers.md), so it gets no
  // extruded column — the same reason a glyph and a frame section don't.
  if (
    el.type === 'shape' &&
    (el.shape === 'frame' || el.shape === 'icon' || el.shape === 'sticker')
  )
    return false;
  return true;
}

// The isometric camera angles (degrees). `z` is the azimuth (spin around the vertical), `x` the elevation (tilt
// away from the viewer).
export const ISO_TILT_DEG = { x: 55, z: -45 } as const;

// The 2D affine matrix of the isometric projection for a flat (z=0) plane,
// used by the image export (docs/specs/010-palette/style-presets.md isometric export). Isometric is a parallel
// (orthographic) projection with no perspective, so projecting the canvas
// plane under `rotateX(elevation) rotateZ(azimuth)` collapses to a plain 2x2
// affine map: an in-plane rotation by the azimuth, then a vertical squash by
// cos(elevation) (the tilt's foreshortening). Returned in canvas
// `transform(a,b,c,d,e,f)` order (e/f are the caller's translation), so a
// point (x,y) maps to (a·x + c·y, b·x + d·y). Defaults to ISO_TILT_DEG.
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

// Extrusion depth, in canvas px, that every boxed element rises off the
// floor in the isometric export. Rendered as a stack of translateZ-offset
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
