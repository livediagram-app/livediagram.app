// The Diagram tour's relaunch signal (docs/specs/007-editor/editor-tour.md "Where it appears"): the Settings row
// Tours › "Diagram Tour", turned on from off and closed, starts the tour there and then when the open tab is in
// Diagram. A window event keeps the dialog decoupled from TourHost, as the Draw and Workshop tours' relaunches do.
export const TOUR_RELAUNCH_EVENT = 'livehuddle:tour-relaunch';

export function requestTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TOUR_RELAUNCH_EVENT));
}
