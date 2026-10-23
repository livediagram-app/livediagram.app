// Share-link previews (docs/specs/013-workspace/share-link-previews.md): what the api tells the live app's worker
// about a share link, so a link pasted into a chat previews with the design's name and picture, and the paths both
// sides build. Shared so the worker and the api cannot drift on the URL shape.

// `GET /api/share/<code>/card`: answered only for a link whose preview names its design (a working, open share
// link with no share password); every other link is a 404.
export type SharePreviewResponse = { name: string };

// The api paths, relative to `/api`.
export function sharePreviewCardPath(code: string): string {
  return `/share/${encodeURIComponent(code)}/card`;
}

export function shareCardImagePath(code: string): string {
  return `/share/${encodeURIComponent(code)}/image.png`;
}

// The origin's brand card (served by the marketing worker), what a preview shows when a link has nothing of its own.
export const BRAND_CARD_PATH = '/opengraph-image';
