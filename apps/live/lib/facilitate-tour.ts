// The Facilitate tour's relaunch signal (docs/specs/012-collaboration/facilitate-tour.md "Where it appears"):
// the Settings row Show Tours › "Facilitate", turned on from off and closed, reruns the tour. A window event
// keeps the dialog decoupled from FacilitateTourHost, as the Diagram and Plan tours' relaunches do.
export const FACILITATE_TOUR_RELAUNCH_EVENT = 'livediagram:facilitate-tour-relaunch';

export function requestFacilitateTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FACILITATE_TOUR_RELAUNCH_EVENT));
}
