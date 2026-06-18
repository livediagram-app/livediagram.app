// Isometric view (spec/45): pure projection constants + helpers for the
// navigation-only isometric canvas tool. Kept out of Canvas.tsx so the
// geometry is unit-testable and the canvas just consumes the values.

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
export function isoTransform(azimuthDeg: number, elevationDeg: number): string {
  return `rotateX(${elevationDeg}deg) rotateZ(${azimuthDeg}deg)`;
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
