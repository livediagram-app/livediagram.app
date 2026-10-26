// A profile picture URL as it may be stored, sent to other people and drawn (liveworkspace/docs/specs/003-accounts/accounts.md "Profile
// pictures"): Google's own `picture` claim, an https URL on Google's profile image host, short enough to ride in an
// ID token, a cookie and a room's presence. One rule for the accounts Worker's readers, every app's API and room, and
// the shared avatar (`PictureDisc` in @liveworkspace/ui), so a URL that passes in one place passes in all of them.
// Dependency-free and Worker-safe.

/** Google's profile image host: the one its `picture` claim names, and the one the pages' CSP must allow. */
export const PROFILE_PICTURE_HOST = 'lh3.googleusercontent.com';

/** The origin a page's `img-src` must allow for pictures to load. */
export const PROFILE_PICTURE_ORIGIN = `https://${PROFILE_PICTURE_HOST}`;

/** Google's picture URLs run to about 100 characters; the cap bounds a cookie, a token and a room's presence. */
export const MAX_PICTURE_URL_LEN = 512;

/** Whether a value is a profile picture URL that may be stored and drawn: https, on Google's image host, with no
 *  port or credentials, at most MAX_PICTURE_URL_LEN characters. Anything else counts as no picture. */
export function isProfilePictureUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_PICTURE_URL_LEN) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === 'https:' &&
    parsed.hostname === PROFILE_PICTURE_HOST &&
    parsed.port === '' &&
    parsed.username === '' &&
    parsed.password === ''
  );
}

/** The URL, or null when it isn't one (isProfilePictureUrl). */
export function profilePictureOf(url: unknown): string | null {
  return isProfilePictureUrl(url) ? url : null;
}

// Google sizes a picture by the options after the path's last `=` (`…=s96-c`: 96 px square, cropped).
const SIZE_OPTIONS = /=[a-z0-9-]*$/i;

/** The size Google's claim itself asks for (`=s96-c`), used when a caller's size is no number. */
export const DEFAULT_PICTURE_PX = 96;

/** The picture as Google serves it at `px` square (`=s<px>-c`, 16 to 1024), replacing whatever size the URL asked
 *  for; DEFAULT_PICTURE_PX when `px` is not a finite number. A URL with a query or a fragment is left as it is: it
 *  isn't the shape Google's claim takes. */
export function sizedPictureUrl(url: string, px: number): string {
  const wanted = typeof px === 'number' && Number.isFinite(px) ? px : DEFAULT_PICTURE_PX;
  const size = Math.max(16, Math.min(1024, Math.round(wanted)));
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.search || parsed.hash) return url;
  return `${url.replace(SIZE_OPTIONS, '')}=s${size}-c`;
}
