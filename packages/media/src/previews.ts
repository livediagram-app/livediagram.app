// Previews (liveworkspace/docs/specs/006-media/previews.md): every app's item pictures, served once by liveworkspace's media
// service under /api/previews. Each app's router forwards the same paths on its own origin, so a browser always
// asks its own origin. The addresses and cache rules live here, so the Explorer, the routers, the apps' share pages
// and the service cannot drift.

// Where previews live, on liveworkspace.app and (forwarded) on every app's origin.
export const PREVIEWS_API_PATH = '/api/previews';

/** An item's preview, for anyone the index lets read the item. `version` (the item's `updatedAt`) keys the
 *  browser's cache; the service decides freshness itself. */
export function previewItemPath(itemId: string, version?: number): string {
  const path = `${PREVIEWS_API_PATH}/items/${encodeURIComponent(itemId)}`;
  return version === undefined ? path : `${path}?v=${version}`;
}

// A share link's three public doors, under the service, and under the address every app has always served them at
// (`/api/share/<code>/<door>`), which its router forwards.
export const SHARE_PREVIEW_DOORS = ['image.svg', 'image.png', 'card'] as const;
export type SharePreviewDoor = (typeof SHARE_PREVIEW_DOORS)[number];

export const isSharePreviewDoor = (value: unknown): value is SharePreviewDoor =>
  typeof value === 'string' && (SHARE_PREVIEW_DOORS as readonly string[]).includes(value);

export function previewSharePath(code: string, door: SharePreviewDoor): string {
  return `${PREVIEWS_API_PATH}/share/${encodeURIComponent(code)}/${door}`;
}

// `GET …/share/<code>/card`: the item's name, for the app's share page head.
export type SharePreviewCard = { name: string };

// ---------- Cache rules ------------------------------------------------------------------------------------------

// An item's preview: the URL carries `?v=<updatedAt>`, so a day is safe, and the same for "nothing drawn".
export const PREVIEW_ITEM_CACHE = 'private, max-age=86400';
// The same through a public link (a Community post's): it must not outlive the post in a browser.
export const PREVIEW_PUBLIC_ITEM_CACHE = 'private, max-age=30';
// No access, or no such item: never kept.
export const PREVIEW_DENIED_CACHE = 'no-store';
// The live image stays close to live without the service drawing on every view.
export const SHARE_IMAGE_CACHE = 'public, max-age=30, stale-while-revalidate=300';
// A share card changes only when its item does, and a chat app keeps its own copy for far longer.
export const SHARE_CARD_CACHE = 'public, max-age=300, stale-while-revalidate=3600';
// A public link's (a Community post's) has no stale window, so it cannot linger once the post is hidden.
export const PUBLIC_LINK_CACHE = 'public, max-age=30';
// The brand card stands in for an item with nothing to draw yet; short, so its first drawing shows soon after.
export const BRAND_CARD_REDIRECT_CACHE = 'public, max-age=300';
// Each app's brand card, on its own origin (its marketing worker's Open Graph image).
export const BRAND_CARD_PATH = '/opengraph-image';
