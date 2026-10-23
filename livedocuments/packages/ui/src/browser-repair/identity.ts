import { signedInHintOf } from '@livedocuments/api-schema';
import { GUEST_IDENTITY_KEYS } from './kept-keys';

// Who this browser is, for the diagnostics report (docs/specs/007-editor/load-recovery.md "Diagnostics").
// Readable from any app on the origin, so the help centre's Repair page reports it too, without the
// session loaded: the guest token liveworkspace issued is plain localStorage, and the api keeps a readable
// `ldoc_signed_in` hint cookie that is `0` signed out and `1` signed in. That cookie says whether, not
// who; the editor adds the account id it resolved.
//
// The guest token is a credential, so only the first GUEST_ID_PREFIX_LENGTH characters of the guest id it
// names (its `sub`, without the `guest_` prefix) ever leave this module.

/** How many characters of a guest id a report carries. */
export const GUEST_ID_PREFIX_LENGTH = 8;

export type BrowserIdentity = {
  /** From the sign-in cookie: true / false, or null when there is none (sign-in not set up, never visited). */
  signedIn: boolean | null;
  /** The guest id's first characters, or null when this browser has no guest token. */
  guestIdPrefix: string | null;
};

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/** The guest id a guest token names, or null when it is not one. Reads the claims; it does not verify. */
export function guestIdOfToken(token: string | null): string | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub?: unknown;
    };
    return typeof claims.sub === 'string' ? claims.sub.replace(/^guest_/, '') : null;
  } catch {
    return null;
  }
}

/** True / false from the signed-in hint cookie, null when there is none. */
export const signedInFromCookie = signedInHintOf;

export function readBrowserIdentity(
  win: Pick<Window, 'localStorage'> & { document: Pick<Document, 'cookie'> } = window,
): BrowserIdentity {
  const guestId = guestIdOfToken(read(() => win.localStorage, GUEST_IDENTITY_KEYS.guestToken));
  let cookie: string;
  try {
    cookie = win.document.cookie;
  } catch {
    cookie = '';
  }
  return {
    signedIn: signedInFromCookie(cookie),
    guestIdPrefix: guestId ? guestId.slice(0, GUEST_ID_PREFIX_LENGTH) : null,
  };
}

const yesNo = (b: boolean) => (b ? 'yes' : 'no');

/**
 * The identity as report lines. `account` is the signed-in account id when the caller knows it (the
 * editor); it also settles "signed in" over the cookie's hint.
 */
export function formatBrowserIdentity(
  id: BrowserIdentity,
  account: string | null = null,
): string[] {
  const signedIn = account !== null ? true : id.signedIn;
  const lines = [
    `Signed in: ${signedIn === null ? 'unknown' : yesNo(signedIn)}${account ? ` (${account})` : ''}`,
    id.guestIdPrefix
      ? `Guest id in this browser: ${id.guestIdPrefix}…`
      : 'Guest id in this browser: none',
  ];
  // Signing in moves a guest's plans to the account and then lets go of the guest token, so one still
  // here while signed in means that move has not happened: the classic "my plans went missing".
  if (signedIn && id.guestIdPrefix) {
    lines.push('Guest documents moved to the account: NOT YET (guest token still present)');
  }
  return lines;
}
