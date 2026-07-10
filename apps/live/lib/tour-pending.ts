// Handoff + once-ever guard for the interactive editor tour (spec/79).
//
// /new marks the tour pending just before hard-navigating to /diagram/<id>
// for a brand-new (zero-diagram) user; the editor consumes (reads + clears)
// the flag and shows the welcome offer card. sessionStorage keeps the
// intent per-tab and self-cleaning; a URL param would survive into
// copy-pasted links.
//
// The done-guard is localStorage: however the offer ends (completed,
// skipped mid-way, or declined on the welcome card), it never comes back
// in this browser — the offer must never read as nagging.
const TOUR_PENDING_KEY = 'livediagram:v2:tour-pending';
const TOUR_DONE_KEY = 'livediagram:v2:tour-done';

export function markTourPending() {
  try {
    sessionStorage.setItem(TOUR_PENDING_KEY, '1');
  } catch {
    // Storage unavailable (private mode quirks): the tour silently doesn't
    // start, which beats blocking diagram creation.
  }
}

// Read-and-clear. Returns true exactly once per marked navigation.
export function consumeTourPending(): boolean {
  try {
    const pending = sessionStorage.getItem(TOUR_PENDING_KEY) === '1';
    if (pending) sessionStorage.removeItem(TOUR_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function markTourDone() {
  try {
    localStorage.setItem(TOUR_DONE_KEY, '1');
  } catch {
    // Best-effort: without storage the offer may reappear next visit.
  }
}

export function clearTourDone() {
  try {
    localStorage.removeItem(TOUR_DONE_KEY);
  } catch {
    // Best-effort, see markTourDone.
  }
}

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

// Settings → tour bridge: the Settings dialog's "I've seen the editor tour"
// row relaunches the tour when unchecked-then-closed. A window event keeps
// the dialog decoupled from TourHost (no shared state to thread through
// the editor context for a one-shot signal).
export const TOUR_RELAUNCH_EVENT = 'livediagram:tour-relaunch';

export function requestTourRelaunch() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TOUR_RELAUNCH_EVENT));
}
