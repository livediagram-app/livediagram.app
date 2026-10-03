// Handoff signal for /new?blank=1&welcome=1 (docs/specs/007-editor/new-document-route.md): the
// marketing hero's launch window grows into a full-screen blank canvas, and the new document must
// open on that same canvas, not on the opening screen. /new marks the landing just before the
// in-place handoff; the editor's load screen (components/chrome/OpeningScreen.tsx) reads it to hold
// the blank canvas, and the editor clears it once the document has loaded, so a later reload
// shows the usual opening screen. sessionStorage, like the tour flag (lib/tour-pending.ts):
// tab-scoped, and never in a copyable URL.
const QUIET_LANDING_KEY = 'livediagram:v2:quiet-landing';

export function markQuietLanding() {
  try {
    sessionStorage.setItem(QUIET_LANDING_KEY, '1');
  } catch {
    // Storage unavailable: the editor opens behind the usual opening screen instead.
  }
}

export function hasQuietLanding(): boolean {
  try {
    return sessionStorage.getItem(QUIET_LANDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearQuietLanding() {
  try {
    sessionStorage.removeItem(QUIET_LANDING_KEY);
  } catch {
    // Best-effort; a lingering flag only quiets a later load screen in this tab.
  }
}
