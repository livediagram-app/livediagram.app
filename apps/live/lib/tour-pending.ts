// One-shot handoff for the interactive editor tour (spec/79): /new sets the
// flag just before hard-navigating to /diagram/<id>, and the editor consumes
// (reads + clears) it once it's ready to start the tour. sessionStorage keeps
// the intent per-tab and self-cleaning; a URL param would survive into
// copy-pasted links.
const TOUR_PENDING_KEY = 'livediagram:v2:tour-pending';

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
