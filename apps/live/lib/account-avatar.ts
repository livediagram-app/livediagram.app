// The account avatar's data (docs/specs/014-identity/profile-picture.md): which picture draws the
// signed-in user to themselves, at what size, and the initial it falls back to. Pure, so the
// Clerk bridge and the tests share one answer.

/** One size for every surface, so the browser fetches the picture once: 44px at 2x, 20px at 4x. */
export const PROFILE_PICTURE_PX = 96;

/** Clerk's image host; its URLs take the documented `width` / `height` / `fit` parameters. */
export const CLERK_IMAGE_HOST = 'img.clerk.com';

/** The slice of Clerk's `UserResource` the resolver reads; the real user satisfies it as is. */
export type ClerkPictureSource = {
  hasImage: boolean;
  imageUrl: string;
  externalAccounts: readonly { provider: string; imageUrl: string }[];
};

/**
 * The profile picture URL, or null for the initials avatar. The Google account's picture comes
 * first because it is the one Google reported last; then Clerk's own image, but only when
 * `hasImage` says it is a real picture rather than Clerk's generated default.
 */
export function resolveProfilePicture(user: ClerkPictureSource): string | null {
  const google = user.externalAccounts.find((a) => a.provider === 'google' && a.imageUrl !== '');
  const fromGoogle = google ? sizedPictureUrl(google.imageUrl) : null;
  if (fromGoogle) return fromGoogle;
  if (!user.hasImage) return null;
  return sizedPictureUrl(user.imageUrl);
}

/** An `https:` URL, cropped to `PROFILE_PICTURE_PX` when Clerk serves it; anything else is null. */
export function sizedPictureUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== CLERK_IMAGE_HOST) return parsed.toString();
  parsed.searchParams.set('width', String(PROFILE_PICTURE_PX));
  parsed.searchParams.set('height', String(PROFILE_PICTURE_PX));
  parsed.searchParams.set('fit', 'crop');
  return parsed.toString();
}

/** The letter on the initials avatar: first name, else username, else '?'. */
export function accountInitial(
  user: { firstName: string | null; username: string | null } | null,
): string {
  return (user?.firstName || user?.username || '?').slice(0, 1).toUpperCase();
}

/** The host a picture URL points at, for logs that must not carry the URL itself. */
export function pictureHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid';
  }
}
