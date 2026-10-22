// How a running tour moves between steps (docs/specs/007-editor/editor-tour.md "Motion"), shared by TourStage,
// TourSpotlight and TourPopover.
import { MOTION_MS } from '@livepages/tailwind-config/motion';

// The dim around a step's target: one shade wherever the tour dims.
export const TOUR_DIM = 'rgba(15, 23, 42, 0.36)';

// The glide from one step's target to the next: the spotlight and the card travel together, once. Ease-in-out
// (gathering pace, then settling) reads as travel; an ease-out start lurched. A tour move, so `long`, the chrome
// ceiling (docs/specs/004-interface-design/motion.md).
export const TOUR_GLIDE_MS = MOTION_MS.long;
export const TOUR_GLIDE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

/** The glide's curve as a function (ease-in-out cubic, the curve TOUR_GLIDE_EASE draws), for the spotlight's tween. */
export function glideEase(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** The transition for the given properties while gliding, none otherwise (a target followed as it moves). */
export function glideTransition(gliding: boolean, properties: readonly string[]): string {
  return gliding
    ? properties.map((p) => `${p} ${TOUR_GLIDE_MS}ms ${TOUR_GLIDE_EASE}`).join(', ')
    : 'none';
}
