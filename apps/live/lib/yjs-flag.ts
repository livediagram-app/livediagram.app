// Feature flag for the Level 2 Yjs-backed realtime path (spec/75).
//
// OFF by default: the shipped behaviour is Levels 0 + 1 (granular element
// ops + ordered room). When on, a session mirrors its diagram into a shared
// Yjs doc and syncs via `ydoc` room ops, getting field-level same-element
// merge. Both collaborators must enable it (mixed sessions don't share the
// doc path), so it's a manual opt-in for testing, not a rollout switch.
//
// Enable via `?yjs=1` on the diagram URL (persisted to localStorage so it
// survives the reload a resync triggers), or `?yjs=0` to force off.

const STORAGE_KEY = 'livediagram:yjs:v1';

export function isYjsRealtimeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('yjs');
    if (q === '1' || q === 'on') {
      window.localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
    if (q === '0' || q === 'off') {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
