// Sign-in's plain helpers (SignInFlow.tsx): the Google return-trip mark in this tab's storage, the day's-codes
// refusal message, and a form field's trimmed value.

export type Step = 'email' | 'code' | 'name' | 'done';
export interface Names {
  givenName: string;
  familyName: string;
}

// Google: the page leaves for Google and comes back to itself, or straight to the app when the
// provider can finish the sign-in on the way. A mark in this tab's storage says which visit is the
// return trip.
export const GOOGLE_MARK = 'liveworkspace:google';

export function storage<T>(action: (s: Storage) => T): T | null {
  try {
    return action(sessionStorage);
  } catch {
    return null;
  }
}

// The accounts Worker's refusal once an address has had its day's codes (liveworkspace/docs/specs/003-accounts/sign-in.md
// "A day's codes per address"). Google still works, and so does a code already sent.
const TOO_MANY_CODES = 'TOO_MANY_CODES';

/** What the page says for that refusal, or null for any other answer. */
export function codeDayMessage(code: unknown, google: boolean): string | null {
  if (code !== TOO_MANY_CODES) return null;
  const then = google ? 'Continue with Google, or try again tomorrow.' : 'Try again tomorrow.';
  return `Too many codes sent to this address today. ${then}`;
}

// A text field's trimmed value.
export function field(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value.trim() : '';
}
