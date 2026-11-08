// The Receptionist's welcome relaunch signal (docs/specs/008-canvas/receptionist.md "The welcome"): the Settings row Tours ›
// "Receptionist's Welcome", turned on from off and closed, opens his welcome again. It kept the retired Avatar tour's event
// name. A window event keeps the dialog decoupled from ReceptionistHost.
export const AVATAR_TOUR_RELAUNCH_EVENT = 'livehuddle:avatar-tour-relaunch';

export function requestAvatarTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AVATAR_TOUR_RELAUNCH_EVENT));
}
