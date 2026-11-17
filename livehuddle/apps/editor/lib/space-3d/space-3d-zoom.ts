// How much closer the 3D view's camera is than the flat plan's (docs/specs/008-canvas/3d-view.md "The camera";
// DEFAULTS.md D145). Pure.

/** Turning the 3D view on multiplies the zoom by this; turning it off divides it back. */
export const SPACE_3D_ZOOM = 1.4;

const clamp = (z: number, min: number, max: number) => Math.min(max, Math.max(min, z));

/** The zoom the view stands up at, from the flat plan's. */
export function space3DZoomIn(zoom: number, min: number, max: number): number {
  return clamp(zoom * SPACE_3D_ZOOM, min, max);
}

/**
 * The zoom the view lies down at: the flat plan's zoom from before, when the zoom was not changed in 3D (so a clamped
 * zoom-in comes back exactly), else the zoom in 3D divided back.
 */
export function space3DZoomOut(
  zoom: number,
  entered: { from: number; to: number } | null,
  min: number,
  max: number,
): number {
  if (entered && Math.abs(zoom - entered.to) < 1e-9) return entered.from;
  return clamp(zoom / SPACE_3D_ZOOM, min, max);
}

/**
 * The tilt's easing, cubic-bezier(0.22, 1, 0.36, 1) (app/space-3d.css `--space-ease`), at `t` in 0..1: the zoom eases
 * on the same curve as the tilt, so the two move as one camera (3d-view.md "It brings the camera closer").
 */
export function space3DEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const [x1, y1, x2, y2] = [0.22, 1, 0.36, 1];
  const at = (a: number, b: number, u: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u ** 2 * (1 - u) + u ** 3;
  // The curve's parameter for this x, by bisection (x rises monotonically along it).
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < t) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}
