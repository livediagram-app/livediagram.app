// The Forms tour's relaunch signal (docs/specs/030-forms/forms.md "The Forms tour"): Show Me Around in the form's cog panel
// reruns the tour. A window event keeps the panel decoupled from FormTourHost, as the other tours' relaunches do.
export const FORM_TOUR_RELAUNCH_EVENT = 'livedesign:form-tour-relaunch';

export function requestFormTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FORM_TOUR_RELAUNCH_EVENT));
}
