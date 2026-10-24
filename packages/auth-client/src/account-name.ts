// The app's readable account name (liveworkspace/docs/accounts.md "An app's signed-in cookies"). Each app's API
// keeps it beside its `<prefix>signed_in` hint: the hint says whether someone is signed in, this says who, so a
// public page (the marketing header's account menu) can show the person without asking the API. It holds no secret
// and authenticates nothing; every request still authenticates with the access token.
//
// Dependency-free and Worker-safe: the API writes it, the page reads it.

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

/** Both readable cookies' `Set-Cookie` values, the name and the full name, set or cleared together. */
export function accountNameCookies(
  cookie: string,
  user: NamedUser | null | undefined,
  maxAge: number,
): string[] {
  return [
    accountNameCookie(cookie, accountNameOf(user), maxAge),
    accountNameCookie(accountFullNameCookieFor(cookie), accountFullNameOf(user), maxAge),
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
