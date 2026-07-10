// Handoff + relaunch signals for the interactive editor tour (spec/79).
//
// /new marks the tour pending just before hard-navigating to /diagram/<id>
// for a brand-new (zero-diagram) user; the editor shows the welcome offer
// card while the flag is set. The flag is cleared only when the offer is
// RESOLVED (taken to the end, skipped, or declined) — never on mere page
// load — so reloading mid-offer or mid-tour brings the offer back instead
// of silently swallowing it. sessionStorage keeps the intent per-tab and
// tab-scoped; a URL param would survive into copy-pasted links.
//
// The once-ever guard is NOT here: it's the synced `tourSeen` user
// preference (spec/20), so answering the offer once covers every device
// the user signs in from.
const TOUR_PENDING_KEY = 'livediagram:v2:tour-pending';

export function markTourPending() {
  try {
    sessionStorage.setItem(TOUR_PENDING_KEY, '1');
  } catch {
    // Storage unavailable (private mode quirks): the tour silently doesn't
    // start, which beats blocking diagram creation.
  }
}

// Peek, don't consume: the flag must survive reloads until the offer is
// resolved (see clearTourPending).
export function hasTourPending(): boolean {
  try {
    return sessionStorage.getItem(TOUR_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearTourPending() {
  try {
    sessionStorage.removeItem(TOUR_PENDING_KEY);
  } catch {
    // Best-effort; a lingering flag is still gated by tourSeen.
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
