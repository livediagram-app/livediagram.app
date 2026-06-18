// Isometric view (spec/45): pure projection constants + helpers for the
// navigation-only isometric canvas tool. Kept out of Canvas.tsx so the
// geometry is unit-testable and the canvas just consumes the values.

// Fixed isometric (axonometric, parallel — no perspective) camera tilt,
// applied on top of the canvas pan / zoom transform. rotateX tips the plane
// away from the viewer; rotateZ spins it so both ground axes recede. Tuned
// for a readable "board seen from above and to the side" rather than the
// steep true-isometric 54.7deg, which buries the content edge-on.
export const ISO_TILT_DEG = { x: 55, z: -45 } as const;

// The CSS transform fragment for the tilt. Placed OUTERMOST (before the
// existing scale()/translate()) so pan + zoom still behave exactly as in 2D
// and the tilt is a pure post-effect about the wrapper centre
// (transform-origin: center). No `perspective` — isometric is parallel
// projection, so there is deliberately no vanishing point.
export const ISO_TILT_TRANSFORM = `rotateX(${ISO_TILT_DEG.x}deg) rotateZ(${ISO_TILT_DEG.z}deg)`;

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

// Per-layer wall shade: lighter just under the element, darker toward the
// floor, so the extruded side reads with a little ambient shading. `index`
// is the layer position (0 = topmost), `count` the total layer count.
export function isoLayerColor(index: number, count: number): string {
  const t = count > 1 ? index / (count - 1) : 0;
  const alpha = 0.6 + 0.35 * t;
  return `rgba(15, 23, 42, ${alpha.toFixed(3)})`;
}
