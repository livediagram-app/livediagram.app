// Double-tap to zoom (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom"): a finger's double-tap on the
// empty canvas zooms in on the tapped spot instead of dropping a text box. Pure, so the view it lands on is tested
// without a canvas.

import { ZOOM_MAX } from './canvas';
import type { ViewPose } from './viewport-glide';

// Each double-tap doubles the zoom: a phone's 60% view lands at 120%, a 200% view at 400%.
export const DOUBLE_TAP_ZOOM_STEP = 2;
// Never less than 100% after a double-tap, so one tap on a zoomed-out overview lands at a readable size rather than
// at 20% or 40%. Safe range: 0.5 to 2.
export const DOUBLE_TAP_MIN_ZOOM = 1;

// Who pressed: only a finger zooms. A mouse, a trackpad or a pen keeps the quick text drop.
export function isDoubleTapZoomPointer(pointerType: string | null): boolean {
  return pointerType === 'touch';
}

/**
 * The view a double-tap lands on: `at` (canvas coords) in the middle of a canvas of `size` (screen px), at the next
 * zoom. The view's offset is the canvas point at its centre's negation (lib/viewport.ts computeViewportCenter), so
 * the zoom does not enter it.
 */
export function doubleTapZoomView(
  at: { x: number; y: number },
  zoom: number,
  size: { width: number; height: number },
): ViewPose {
  const next = Math.min(ZOOM_MAX, Math.max(zoom, zoom * DOUBLE_TAP_ZOOM_STEP, DOUBLE_TAP_MIN_ZOOM));
  return { zoom: next, offset: { x: size.width / 2 - at.x, y: size.height / 2 - at.y } };
}
