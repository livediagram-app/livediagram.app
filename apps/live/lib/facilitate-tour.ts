// The Facilitate tour's relaunch signal (docs/specs/012-collaboration/facilitate-tour.md "Where it appears"):
// the Settings row Show Tours › "Facilitate Tour", turned on from off and closed, reruns the tour. A window event
// keeps the dialog decoupled from FacilitateTourHost, as the welcome and Plan tours' relaunches do.
export const FACILITATE_TOUR_RELAUNCH_EVENT = 'livediagram:facilitate-tour-relaunch';

export function requestFacilitateTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FACILITATE_TOUR_RELAUNCH_EVENT));
}

// The welcome tour's closing card can start the Facilitate tour straight into its steps (its own welcome card
// would ask the same question twice): "Show Me Facilitate" sends this, FacilitateTourHost answers it.
export const FACILITATE_TOUR_START_EVENT = 'livediagram:facilitate-tour-start';

export function requestFacilitateTourStart(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FACILITATE_TOUR_START_EVENT));
}
