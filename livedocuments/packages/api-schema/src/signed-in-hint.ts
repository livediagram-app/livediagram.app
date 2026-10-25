// The readable "this browser has a session" hint (docs/specs/014-identity/auth-and-guest-access.md
// "Who is a guest, before sign-in answers"). The api sets it beside the HttpOnly refresh cookie:
// `1` when a sign-in completes, `0` when the session ends. It holds no secret and says whether, not
// who, so any app on the origin can read it without the session: the editor picks a default save
// location from it, the site header its primary link, and the Repair page reports it. It only ever
// picks a default; every request still authenticates the real way.

export const SIGNED_IN_HINT_COOKIE = 'ldoc_signed_in';

/** True / false from the hint in a `document.cookie` string, null when the browser has none. */
export function signedInHintOf(cookie: string): boolean | null {
  for (const part of cookie.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== SIGNED_IN_HINT_COOKIE) continue;
    return part.slice(at + 1).trim() === '1';
  }
  return null;
}
