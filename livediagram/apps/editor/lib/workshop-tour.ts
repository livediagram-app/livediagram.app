// The Workshop tour's relaunch signal (docs/specs/012-collaboration/workshop-tour.md "Where it appears"):
// the Settings row Tours › "Workshop Tour", turned on from off and closed, reruns the tour. A window event
// keeps the dialog decoupled from WorkshopTourHost, as the Diagram and Draw tours' relaunches do.
export const WORKSHOP_TOUR_RELAUNCH_EVENT = 'livediagram:workshop-tour-relaunch';

export function requestWorkshopTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WORKSHOP_TOUR_RELAUNCH_EVENT));
}
