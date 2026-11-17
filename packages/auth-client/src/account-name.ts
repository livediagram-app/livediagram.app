// The app's readable account name (liveworkspace/docs/specs/003-accounts/accounts.md "An app's signed-in cookies"). Each app's API
// keeps it beside its `<prefix>signed_in` hint: the hint says whether someone is signed in, this says who, so a
// public page (the marketing header's account menu) can show the person without asking the API. It holds no secret
// and authenticates nothing; every request still authenticates with the access token.
//
// Worker-safe: the API writes it, the page reads it.

import { profilePictureOf } from '@liveworkspace/sites/picture';
import { isSafeColourValue } from '@liveworkspace/settings/presence';

/** The longest name kept, in characters; a longer one is cut (the header truncates it anyway). */
export const ACCOUNT_NAME_MAX_LENGTH = 64;

const HINT_SUFFIX = 'signed_in';

/** The name cookie of the app whose hint is `hint` (`ld_signed_in` → `ld_account`), so apps sharing a host (every
 *  app on `localhost` in development) never read each other's. */
export function accountNameCookieFor(hint: string): string {
  if (!hint.endsWith(HINT_SUFFIX)) throw new Error(`not a signed-in hint: ${hint}`);
  return `${hint.slice(0, -HINT_SUFFIX.length)}account`;
}

type NamedUser = {
  givenName?: string | null;
  name?: string | null;
  email?: string | null;
  // The profile's presence colour (the ID token's `presence_color`), null for Automatic.
  color?: string | null;
  // The account's own Google picture (the ID token's `picture`), null with none.
  picture?: string | null;
};

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The name a header shows for an account, as liveworkspace.app's does: the given name, else the full name, else
 *  the email. Null with none of them. */
export function accountNameOf(user: NamedUser | null | undefined): string | null {
  if (!user) return null;
  const name = text(user.givenName) ?? text(user.name) ?? text(user.email);
  return name ? Array.from(name).slice(0, ACCOUNT_NAME_MAX_LENGTH).join('') : null;
}

/** The full-name cookie beside the name cookie (`ld_account` → `ld_account_full`), for the avatar's initials. */
export function accountFullNameCookieFor(nameCookie: string): string {
  return `${nameCookie}_full`;
}

/** The account's full name, when it has one the header name doesn't already give (a header shows the given name),
 *  so an avatar can take the first and last names' first letters. Null otherwise. */
export function accountFullNameOf(user: NamedUser | null | undefined): string | null {
  const full = text(user?.name);
  if (!full || full === accountNameOf(user)) return null;
  return Array.from(full).slice(0, ACCOUNT_NAME_MAX_LENGTH).join('');
}

/** The colour cookie beside the name cookie (`ld_account` → `ld_account_colour`), for the avatar's fill. */
export function accountColourCookieFor(nameCookie: string): string {
  return `${nameCookie}_colour`;
}

// The longest colour kept, and whether a colour is safe to paint into CSS: one rule with the presence colours
// (@liveworkspace/settings/presence, which an assignee's dot reads too), re-exported for the account's readers.
export {
  PROFILE_COLOUR_MAX as ACCOUNT_COLOUR_MAX_LENGTH,
  isSafeColourValue,
} from '@liveworkspace/settings/presence';

/** The account's presence colour, trimmed, when it has one that is safe to paint; null otherwise (Automatic). */
export function accountColourOf(user: NamedUser | null | undefined): string | null {
  const colour = text(user?.color);
  return isSafeColourValue(colour) ? colour : null;
}

/** The picture cookie beside the name cookie (`ld_account` → `ld_account_picture`), for the avatar's picture
 *  (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"). */
export function accountPictureCookieFor(nameCookie: string): string {
  return `${nameCookie}_picture`;
}

/** The account's own picture, when it has one the avatar may draw (isProfilePictureUrl); null otherwise. */
export function accountPictureOf(user: NamedUser | null | undefined): string | null {
  return profilePictureOf(user?.picture);
}

/** The readable cookies' `Set-Cookie` values, the name, the full name, the colour and the picture, set or cleared
 *  together. */
export function accountNameCookies(
  cookie: string,
  user: NamedUser | null | undefined,
  maxAge: number,
): string[] {
  return [
    accountNameCookie(cookie, accountNameOf(user), maxAge),
    accountNameCookie(accountFullNameCookieFor(cookie), accountFullNameOf(user), maxAge),
    accountNameCookie(accountColourCookieFor(cookie), accountColourOf(user), maxAge),
    accountNameCookie(accountPictureCookieFor(cookie), accountPictureOf(user), maxAge),
  ];
}

/** The `Set-Cookie` value: the name, readable from script on the whole site, for `maxAge` seconds; or, with no
 *  name, the cookie cleared. */
export function accountNameCookie(cookie: string, name: string | null, maxAge: number): string {
  const value = name ? encodeURIComponent(name) : '';
  return `${cookie}=${value}; Path=/; Secure; SameSite=Lax; Max-Age=${name ? maxAge : 0}`;
}

/** The name in a `document.cookie` string (or a `Cookie` header), or null when there is none. */
export function readAccountName(cookies: string, cookie: string): string | null {
  for (const part of cookies.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0 || part.slice(0, eq).trim() !== cookie) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return null;
    try {
      return text(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
  return null;
}

/** The picture in a `document.cookie` string, or null when there is none or it isn't one the avatar may draw. */
export function readAccountPicture(cookies: string, cookie: string): string | null {
  return profilePictureOf(readAccountName(cookies, cookie));
}

/** The colour in a `document.cookie` string, or null when there is none or it isn't safe to paint. */
export function readAccountColour(cookies: string, cookie: string): string | null {
  const colour = readAccountName(cookies, cookie);
  return isSafeColourValue(colour) ? colour : null;
}
