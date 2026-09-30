// The profile picture's data (docs/specs/014-identity/profile-picture.md): which picture draws a
// signed-in person, how it is requested from Clerk, and the initial it falls back to. Pure, so the
// Clerk bridge, every avatar surface and the tests share one answer.

import { isProfilePictureUrl } from '@livediagram/api-schema';

/**
 * The sizes Clerk is asked for: 96px covers the largest disc (44px) at 2x, 192px at 3x and up.
 * Size only, never `fit=crop`: Clerk answers a crop with a 160x96 band that the circle crops
 * again, zooming the face in; a square size keeps the framing Google chose.
 */
export const PICTURE_SIZES_PX = [96, 192] as const;

/** The slice of Clerk's `UserResource` the resolver reads; the real user satisfies it as is. */
export type ClerkPictureSource = {
  hasImage: boolean;
  imageUrl: string;
  externalAccounts: readonly { provider: string; imageUrl: string }[];
};

/** What a Clerk image URL says it serves (spec §1): observed, undocumented, read defensively. */
export type ClerkImageSource = 'upload' | 'oauth' | 'default' | 'other' | 'unknown';

const CLERK_STORAGE_HOST = 'images.clerk.dev';

/**
 * The source a Clerk image URL encodes in its first path segment, a base64url JSON object. Any
 * URL that does not decode cleanly is `'unknown'`, never `'upload'`, so a format change at Clerk
 * can only make an upload lose to the Google picture, not the other way round.
 */
export function clerkImageSource(url: string): ClerkImageSource {
  try {
    const parsed = new URL(url);
    if (!isProfilePictureUrl(`${parsed.origin}${parsed.pathname}`)) return 'unknown';
    const segment = parsed.pathname.split('/')[1] ?? '';
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = JSON.parse(json) as { type?: unknown; src?: unknown };
    if (decoded.type === 'default') return 'default';
    if (decoded.type !== 'proxy' || typeof decoded.src !== 'string') return 'unknown';
    const src = new URL(decoded.src);
    if (src.hostname !== CLERK_STORAGE_HOST) return 'other';
    if (src.pathname.startsWith('/uploaded/')) return 'upload';
    if (src.pathname.startsWith('/oauth_')) return 'oauth';
    return 'other';
  } catch {
    return 'unknown';
  }
}

/**
 * The profile picture URL, or null for the initials avatar (spec §2): a manual upload over the
 * Google picture, the Google picture over Clerk's copy of it, and never Clerk's generated default.
 * Only https URLs on Clerk's image host count.
 */
export function resolveProfilePicture(user: ClerkPictureSource): string | null {
  const own = user.hasImage && isProfilePictureUrl(user.imageUrl) ? user.imageUrl : null;
  if (own && clerkImageSource(own) === 'upload') return own;
  const google = user.externalAccounts.find(
    (a) => a.provider === 'google' && isProfilePictureUrl(a.imageUrl),
  );
  if (google) return google.imageUrl;
  return own;
}

/** The picture at `px` square: Clerk's documented `width` / `height`, with any `fit` removed. */
export function pictureSrc(url: string, px: number): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('fit');
  parsed.searchParams.set('width', String(px));
  parsed.searchParams.set('height', String(px));
  return parsed.toString();
}

/** Width-described sources, so each disc's `sizes` picks 1x or 2x crisp. */
export function pictureSrcSet(url: string): string {
  return PICTURE_SIZES_PX.map((px) => `${pictureSrc(url, px)} ${px}w`).join(', ');
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
