// The coach dock's constants and the words it builds (docs/specs/007-editor/coach-dock.md,
// blueprints/coach-dock.md "Constants and configuration"). Pure.

// The dock floor on <html>: how far the dock's top edge sits above the window's bottom, which a phone's bottom
// sheets stand on (spec "Where it sits"). Unset with no tour in the dock.
export const COACH_DOCK_FLOOR_VAR = '--coach-dock-floor';

// An offer, or a closing, left alone this long folds away (spec "The offer").
export const OFFER_FOLD_MS = 12_000;
// The beat between a Try it landing and the next step, so the person sees their pick land (spec "A step").
export const TRY_IT_ADVANCE_MS = 900;
// The room between a control and its ring (spec "The pointer").
export const RING_PAD_PX = 6;
// The step badge on the ring's corner: room for two digits in 11px type.
export const BADGE_SIZE_PX = 20;

/** How long a tour is, said on its offer: "4 stops, about a minute". */
export function tourLength(stops: number): string {
  if (stops <= 1) return '1 stop, under a minute';
  return stops <= 6 ? `${stops} stops, about a minute` : `${stops} stops, about two minutes`;
}

/** The polite announcement of a step as it arrives: "Slides tour, step 2 of 4: Change the Background". */
export function stepAnnouncement(eyebrow: string, n: number, of: number, title: string): string {
  return `${eyebrow}, step ${n} of ${of}: ${title}`;
}
