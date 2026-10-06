// How a profile picture is requested and logged (docs/specs/014-identity/profile-picture.md): the sizes asked
// of Clerk, the URL for each, and the host a log may name. Pure; shared by PictureDisc and every app that draws
// a person (the editor, the Community app, the landing page).

/**
 * The sizes Clerk is asked for: 96px covers the largest disc (44px) at 2x, 192px at 3x and up.
 * Size only, never `fit=crop`: Clerk answers a crop with a 160x96 band that the circle crops
 * again, zooming the face in; a square size keeps the framing Google chose.
 */
export const PICTURE_SIZES_PX = [96, 192] as const;

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

/** The host a picture URL points at, for logs that must not carry the URL itself. */
export function pictureHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid';
  }
}
