// The Draw tour's relaunch signal (docs/specs/023-draw-mode/draw-tour.md "Where it appears"): the Settings row
// Tours › "Draw Tour", turned on from off and closed, reruns the tour. A window event keeps the dialog decoupled
// from DrawTourHost, as the Diagram and Workshop tours' relaunches do.
export const DRAW_TOUR_RELAUNCH_EVENT = 'livehuddle:draw-tour-relaunch';

export function requestDrawTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DRAW_TOUR_RELAUNCH_EVENT));
}
