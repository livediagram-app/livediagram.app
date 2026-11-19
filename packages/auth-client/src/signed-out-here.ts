// "Signed out of this app only" (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"): when an app's
// sign-out couldn't end the liveworkspace session (the accounts site didn't answer, or there was no refresh token),
// the page notes it in the tab before it leaves, and the page it lands on takes the note once and says so. No imports:
// a visitor's header reads it, and must carry nothing else for it.

export const SIGNED_OUT_HERE_KEY = 'lw:signed-out-here';

/** How long a note waits for the page that shows it: the landing page reads it within a second or two, and a note no
 *  page took (a sign-out that landed somewhere with no account control) must never surface later in the tab. */
export const SIGNED_OUT_HERE_FRESH_MS = 60_000;

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Notes, in this tab, that only this app signed out. A blocked sessionStorage drops it. */
export function noteSignedOutHere(now = Date.now()): void {
  try {
    storage()?.setItem(SIGNED_OUT_HERE_KEY, JSON.stringify({ at: now }));
  } catch {
    // Storage full or blocked: the notice is a courtesy, and the sign-out itself has happened.
  }
}

/** Whether this tab's last sign-out was of this app only, a moment ago; takes the note, so it shows once. */
export function takeSignedOutHere(now = Date.now()): boolean {
  const store = storage();
  if (!store) return false;
  let raw: string | null;
  try {
    raw = store.getItem(SIGNED_OUT_HERE_KEY);
    if (raw === null) return false;
    store.removeItem(SIGNED_OUT_HERE_KEY);
  } catch {
    return false;
  }
  let at: unknown;
  try {
    at = (JSON.parse(raw) as { at?: unknown } | null)?.at;
  } catch {
    return false;
  }
  return typeof at === 'number' && now - at >= 0 && now - at < SIGNED_OUT_HERE_FRESH_MS;
}
