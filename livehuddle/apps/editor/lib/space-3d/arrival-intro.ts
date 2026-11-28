// The arrival's overview (docs/specs/008-canvas/3d-view.md "Arriving"): a tab opens framing the whole Space, holds,
// then zooms in to your character. Pure, but for `arrivalIntroPlaying`, the module store that says it is playing so the
// walls layer holds its drawn area until it ends.

import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import type { ViewPose } from '@liveworkspace/workbench/lib/viewport-glide';
import { ZOOM_MIN } from '@liveworkspace/workbench/lib/zoom-range';

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** How long the whole Space shows before the zoom in starts. */
export const INTRO_HOLD_MS = 500;
/** How long the zoom in takes. */
export const INTRO_ZOOM_MS = 1400;
/** Less than this much closer, the overview shows nothing new: the tab lands at once. */
export const INTRO_MIN_RATIO = 1.25;

/** True while an arrival's overview is on screen (held or zooming in). */
export const arrivalIntroPlaying = createStateStore<boolean>(false);

/** Ease-in-out cubic over 0..1. */
export function introEase(k: number): number {
  const t = Math.min(1, Math.max(0, k));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** The overview to start from: the fit, never closer than the end and never past the zoom range. */
export function introStart(fit: ViewPose, end: ViewPose): ViewPose {
  return { zoom: Math.min(end.zoom, Math.max(ZOOM_MIN, fit.zoom)), offset: fit.offset };
}

/** Whether the overview is worth showing: the end is at least `INTRO_MIN_RATIO` closer than the start. */
export function introWorthPlaying(start: ViewPose, end: ViewPose): boolean {
  return Number.isFinite(start.zoom) && start.zoom > 0 && end.zoom / start.zoom >= INTRO_MIN_RATIO;
}

// The canvas point in the middle of the screen: the view is `scale(zoom) translate(offset)` about the centre.
function middleOf(view: ViewPose, size: Size): Point {
  return { x: size.width / 2 - view.offset.x, y: size.height / 2 - view.offset.y };
}

/**
 * The view `k` (0..1, unclamped input) of the way from `from` to `to`, eased. The zoom moves in log space, so it
 * doubles at an even pace; `target` (your character) slides in a straight line on screen from where `from` shows it
 * to where `to` does, so the eye can stay on it. At 0 it is `from`, at 1 exactly `to`.
 */
export function introPose(
  from: ViewPose,
  to: ViewPose,
  target: Point,
  size: Size,
  k: number,
): ViewPose {
  if (k >= 1) return to;
  const e = introEase(k);
  if (e <= 0) return from;
  const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e);
  const m0 = middleOf(from, size);
  const m1 = middleOf(to, size);
  // The target's screen distance from the middle, straight from where it starts to where it ends.
  const sx = (target.x - m0.x) * from.zoom * (1 - e) + (target.x - m1.x) * to.zoom * e;
  const sy = (target.y - m0.y) * from.zoom * (1 - e) + (target.y - m1.y) * to.zoom * e;
  const middle = { x: target.x - sx / zoom, y: target.y - sy / zoom };
  return { zoom, offset: { x: size.width / 2 - middle.x, y: size.height / 2 - middle.y } };
}
