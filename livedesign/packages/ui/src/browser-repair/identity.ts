import { GUEST_IDENTITY_KEYS } from './kept-keys';

// Who this browser is, for the diagnostics report (docs/specs/007-editor/load-recovery.md "Diagnostics").
// Readable from any app on the origin, so the help centre's Repair page reports it too, without the
// sign-in provider loaded: the guest identity is plain localStorage, and the provider keeps a readable
// `__client_uat` cookie that is `0` signed out and a timestamp signed in. That cookie says whether, not
// who; the editor adds the account id it resolved.
//
// A full guest id is an `X-Owner-Id` credential, so only its first GUEST_ID_PREFIX_LENGTH characters
// ever leave this module.

/** How many characters of a guest id a report carries. */
export const GUEST_ID_PREFIX_LENGTH = 8;

/** The sign-in provider's "client updated at" cookie; development instances add a suffix. */
const SIGN_IN_COOKIE = /^__client_uat(_[A-Za-z0-9-]+)?$/;

export type BrowserIdentity = {
  /** From the sign-in cookie: true / false, or null when there is none (sign-in not set up, never visited). */
  signedIn: boolean | null;
  /** The guest id's first characters, or null when this browser has none. */
  guestIdPrefix: string | null;
  guestSigned: boolean;
  pendingUpgrade: boolean;
};

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/** True / false from the sign-in cookie, null when there is none. Signed in on any instance wins. */
export function signedInFromCookie(cookie: string): boolean | null {
  let seen: boolean | null = null;
  for (const part of cookie.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    if (!SIGN_IN_COOKIE.test(name)) continue;
    const value = Number(part.slice(at + 1).trim());
    if (Number.isFinite(value) && value > 0) return true;
    seen = false;
  }
  return seen;
}

export function readBrowserIdentity(
  win: Pick<Window, 'localStorage'> & { document: Pick<Document, 'cookie'> } = window,
): BrowserIdentity {
  const ls = () => win.localStorage;
  const guestId = read(ls, GUEST_IDENTITY_KEYS.selfId);
  let cookie: string;
  try {
    cookie = win.document.cookie;
  } catch {
    cookie = '';
  }
  return {
    signedIn: signedInFromCookie(cookie),
    guestIdPrefix: guestId ? guestId.slice(0, GUEST_ID_PREFIX_LENGTH) : null,
    guestSigned: read(ls, GUEST_IDENTITY_KEYS.selfSig) !== null,
    pendingUpgrade: read(ls, GUEST_IDENTITY_KEYS.pendingUpgrade) !== null,
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
      ? `Guest id in this browser: ${id.guestIdPrefix}… (signed: ${yesNo(id.guestSigned)})`
      : 'Guest id in this browser: none',
    `Identity upgrade pending: ${yesNo(id.pendingUpgrade)}`,
  ];
  // Signing in moves a guest's documents to the account and then clears the guest id, so one still
  // here while signed in means that move has not happened: the classic "my documents went missing".
  if (signedIn && id.guestIdPrefix) {
    lines.push('Guest documents moved to the account: NOT YET (guest id still present)');
  }
  return lines;
}
