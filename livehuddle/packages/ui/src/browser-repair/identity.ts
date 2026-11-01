import { signedInHintOf } from '@livehuddle/api-schema';
import { parseGuestToken } from '@liveworkspace/index-client/browser';
import { GUEST_IDENTITY_KEYS } from './kept-keys';

// Who this browser is, for the diagnostics report (docs/specs/007-editor/load-recovery.md "Diagnostics").
// Readable from any app on the origin, so the help centre's Repair page reports it too, without the
// session loaded: the guest token is plain localStorage, and the api keeps a readable
// `ld_signed_in` hint cookie that is `0` signed out and `1` signed in. That cookie says whether, not
// who; the editor adds the account id it resolved.
//
// Only the first GUEST_ID_PREFIX_LENGTH characters of the guest's id ever leave this module, and the
// token itself never does.

/** How many characters of a guest id (after its `guest_` prefix) a report carries. */
export const GUEST_ID_PREFIX_LENGTH = 8;

export type BrowserIdentity = {
  /** From the sign-in cookie: true / false, or null when there is none (sign-in not set up, never visited). */
  signedIn: boolean | null;
  /** The guest id's first characters, or null when this browser has no guest token. */
  guestIdPrefix: string | null;
  /** When the guest token runs out (ms since the epoch), or null with none. */
  guestExpiresAt: number | null;
};

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/** True / false from the signed-in hint cookie, null when there is none. */
export const signedInFromCookie = signedInHintOf;

export function readBrowserIdentity(
  win: Pick<Window, 'localStorage'> & { document: Pick<Document, 'cookie'> } = window,
): BrowserIdentity {
  const raw = read(() => win.localStorage, GUEST_IDENTITY_KEYS.guestToken);
  const guest = raw ? parseGuestToken(raw) : null;
  let cookie: string;
  try {
    cookie = win.document.cookie;
  } catch {
    cookie = '';
  }
  return {
    signedIn: signedInFromCookie(cookie),
    guestIdPrefix: guest ? guest.id.replace(/^guest_/, '').slice(0, GUEST_ID_PREFIX_LENGTH) : null,
    guestExpiresAt: guest?.expiresAt ?? null,
  };
}

const yesNo = (b: boolean) => (b ? 'yes' : 'no');

/**
 * The identity as report lines. `account` is the signed-in account id when the caller knows it (the
 * editor); it also settles "signed in" over the cookie's hint. `now` dates the guest token.
 */
export function formatBrowserIdentity(
  id: BrowserIdentity,
  account: string | null = null,
  now: number = Date.now(),
): string[] {
  const signedIn = account !== null ? true : id.signedIn;
  const lines = [
    `Signed in: ${signedIn === null ? 'unknown' : yesNo(signedIn)}${account ? ` (${account})` : ''}`,
  ];
  if (!id.guestIdPrefix) {
    lines.push('Guest in this browser: none');
  } else {
    const expired = id.guestExpiresAt !== null && id.guestExpiresAt <= now;
    lines.push(
      `Guest in this browser: guest_${id.guestIdPrefix}… (${expired ? 'expired' : 'current'})`,
    );
  }
  return lines;
}
