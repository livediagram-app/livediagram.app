// Double-tap to zoom (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom"): a finger's double-tap on the
// empty canvas zooms in on the tapped spot instead of dropping a text box, the next one fits the whole tab, and one on
// an element too small to work on frames it before it edits. Pure, so the views it lands on are tested without a
// canvas.

import { ZOOM_MAX } from './canvas';
import { computeFitToScreen, FIT_TO_SCREEN_PADDING } from './viewport';
import type { ViewPose } from './viewport-glide';

// Each double-tap doubles the zoom: a phone's 60% view lands at 120%, a 200% view at 400%.
const DOUBLE_TAP_ZOOM_STEP = 2;
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

// An element is too small to work on when its on-screen box is under this on its shorter side: a fingertip, the
// touch-target size (docs/specs/004-interface-design/touch-targets.md). Safe range: 24 to 64.
export const DOUBLE_TAP_SMALL_ELEMENT_PX = 44;
// Framing a small element zooms no further than this, so a tiny sticker does not fill the screen. Safe range: 1.5 to 3.
export const DOUBLE_TAP_FRAME_MAX_ZOOM = 2;

/**
 * The view a double-tap on an element frames it in, or null when the element is big enough to edit at once: the
 * canvas is at 100% or more, or its on-screen box (`onScreen`, screen px) is at least DOUBLE_TAP_SMALL_ELEMENT_PX on
 * its shorter side. `box` is the element's box in canvas coords; it lands in the middle of the canvas, fitted with the
 * Fit to Screen padding, between 100% (so the next double-tap edits) and DOUBLE_TAP_FRAME_MAX_ZOOM, never below
 * `zoom`.
 */
export function doubleTapFrameView(
  box: { x: number; y: number; width: number; height: number },
  onScreen: { width: number; height: number },
  zoom: number,
  size: { width: number; height: number },
): ViewPose | null {
  if (zoom >= DOUBLE_TAP_MIN_ZOOM) return null;
  if (Math.min(onScreen.width, onScreen.height) >= DOUBLE_TAP_SMALL_ELEMENT_PX) return null;
  const fit = computeFitToScreen(size, box, DOUBLE_TAP_FRAME_MAX_ZOOM, FIT_TO_SCREEN_PADDING);
  return {
    zoom: Math.min(DOUBLE_TAP_FRAME_MAX_ZOOM, Math.max(fit.zoom, zoom, DOUBLE_TAP_MIN_ZOOM)),
    offset: fit.offset,
  };
}

// How much closer than the whole-tab fit the view must be for a fit to move anything (a 1% zoom difference).
const FIT_ZOOM_SLACK = 1.01;

/**
 * Whether a double-tap on the empty canvas fits the whole tab rather than zooming in: only right after a double-tap
 * zoomed in, and only while the view is still closer than the fit (a pinch back out to it or wider leaves nothing to
 * fit, so the double-tap zooms in again).
 */
export function doubleTapFitsTab(zoomedIn: boolean, zoom: number, fit: ViewPose | null): boolean {
  return zoomedIn && fit !== null && zoom > fit.zoom * FIT_ZOOM_SLACK;
}
