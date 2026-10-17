// The Avatar tour's relaunch signal (docs/specs/008-canvas/avatar-tour.md "Where it appears"): the Settings row
// Tours › "Avatar Tour", turned on from off and closed, reruns the tour. A window event keeps the dialog decoupled
// from AvatarTourHost, as the Drawing tour's relaunch does.
export const AVATAR_TOUR_RELAUNCH_EVENT = 'livediagram:avatar-tour-relaunch';

export function requestAvatarTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AVATAR_TOUR_RELAUNCH_EVENT));
}
