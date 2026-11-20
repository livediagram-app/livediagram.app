// Sign In to Request Access (liveworkspace/docs/specs/004-index/request-access.md "On screen"): the signed-out card's
// button marks, for this browser tab and address, that the person is signing in to ask; the signed-in card reads it
// once and opens its note. sessionStorage is tab-scoped and survives the sign-in round trip on the same origin.

const KEY = 'liveworkspace:request-access-intent';

function here(): string {
  return window.location.pathname;
}

/** Mark that the person is signing in to ask for the item at this address. */
export function markRequestIntent(): void {
  try {
    window.sessionStorage.setItem(KEY, here());
  } catch {
    // Blocked storage: they sign in and press Request Access themselves.
  }
}

/** Whether the person came back from signing in to ask for this address; read once (the mark is dropped). */
export function takeRequestIntent(): boolean {
  try {
    const at = window.sessionStorage.getItem(KEY);
    if (at === null) return false;
    window.sessionStorage.removeItem(KEY);
    return at === here();
  } catch {
    return false;
  }
}
