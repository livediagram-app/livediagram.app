// The Illustrate tour's relaunch signal (docs/specs/007-editor/illustrate-tour.md "Where it appears"): the Settings
// row Onboarding Tutorials › "Illustrate", turned on from off and closed, reruns the tour. A window event keeps the dialog
// decoupled from IllustrateTourHost, as the other tours' relaunches do.
export const ILLUSTRATE_TOUR_RELAUNCH_EVENT = 'livediagram:illustrate-tour-relaunch';

export function requestIllustrateTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ILLUSTRATE_TOUR_RELAUNCH_EVENT));
}
