// A profile picture URL as it may cross to other people (docs/specs/014-identity/profile-picture.md
// §2, §6): https on Clerk's image host, short enough for a room session attachment. Shared by the
// api (participant record, realtime room) and the editor (what it draws), so both apply one rule.

/** Clerk's image host: the one its image optimization and CSP guides name. */
export const PROFILE_PICTURE_HOST = 'img.clerk.com';

/** Observed Clerk proxy URLs stay under 350 characters; the cap bounds the room attachment. */
export const MAX_PICTURE_URL_LEN = 512;

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
