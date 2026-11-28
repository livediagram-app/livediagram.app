// Real 3D's camera (docs/specs/008-canvas/3d-engine.md "The camera and the pixel look"): the WebGL scene is drawn
// through exactly the projection the browser gives the 3D view's stage and world layer, read from their computed
// styles each frame, so the floor (still the DOM's), the chips and bubbles over heads and the 3D scene line up to the
// pixel, the tilt's and the turn's easing included. Scene units are canvas px: x right, y down the canvas, z up.

/** How far the depth buffer reaches, as a share of the perspective (DEFAULTS: anything this near the eye clips). */
export const DEPTH_K = 0.45 / 1100;

type Size = { width: number; height: number };

/** A column-major 4x4 (three.js `Matrix4.fromArray`), canvas px to clip space. */
export type ClipMatrix = Float64Array;

function readMatrix(transform: string): DOMMatrix {
  return !transform || transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
}

/** The scale property's z (`1 1 1.4`), 1 when unset. */
export function scaleZ(scale: string): number {
  const parts = scale.trim().split(/\s+/);
  if (parts.length < 3) return 1;
  const z = Number.parseFloat(parts[2]!);
  return Number.isFinite(z) ? z : 1;
}

/**
 * The matrix from canvas px (z up) to clip space, from the stage's and the world layer's computed transforms (both
 * about the middle of a box of `size`) and the world layer's z scale. Pure but for DOMMatrix.
 */
export function clipMatrix(
  stage: string,
  world: string,
  worldScaleZ: number,
  size: Size,
): ClipMatrix {
  const cx = size.width / 2;
  const cy = size.height / 2;
  // T(c) · Stage · Scale(1, 1, z) · World · T(-c)
  const m = new DOMMatrix()
    .translate(cx, cy)
    .multiply(readMatrix(stage))
    .scale(1, 1, worldScaleZ)
    .multiply(readMatrix(world))
    .translate(-cx, -cy);
  // To clip space: x and y to -1..1 (y up), depth from the stage's z.
  const ndc = new DOMMatrix([
    2 / size.width,
    0,
    0,
    0,
    0,
    -2 / size.height,
    0,
    0,
    0,
    0,
    -DEPTH_K,
    0,
    -1,
    1,
    0,
    1,
  ]);
  return ndc.multiply(m).toFloat64Array();
}

/** Where a canvas point (z up) lands on the screen, relative to the box, through a clip matrix: for tests and picks. */
export function projectPoint(
  clip: ClipMatrix,
  p: { x: number; y: number; z: number },
  size: Size,
): { x: number; y: number; depth: number } | null {
  const m = clip;
  const x = m[0]! * p.x + m[4]! * p.y + m[8]! * p.z + m[12]!;
  const y = m[1]! * p.x + m[5]! * p.y + m[9]! * p.z + m[13]!;
  const z = m[2]! * p.x + m[6]! * p.y + m[10]! * p.z + m[14]!;
  const w = m[3]! * p.x + m[7]! * p.y + m[11]! * p.z + m[15]!;
  if (w <= 0) return null;
  return { x: ((x / w + 1) / 2) * size.width, y: ((1 - y / w) / 2) * size.height, depth: z / w };
}
