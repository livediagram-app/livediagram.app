// A Participant's placement claim (each product's docs/specs/009-elements/images.md "Placement grants"): the images
// a Participant places reach the item through its room, which knows no person, so nothing there grants them and
// every other reader would see the placeholder. Before its element ops go to the room, the Participant's editor
// claims the gallery images they carry (`POST /api/images/grants?d=<item>`, body `{ ids }`); the app grants the
// item each one the caller uploaded, while the caller may add to the item. This file is the wire rule both sides
// share: which ids a set of element ops places, the request's cap and parse, and the editor's per-session memory of
// what it has claimed.

import { isGalleryImageId } from './gallery-id';

// Ids one claim carries; a larger set goes as several.
export const IMAGE_GRANT_IDS_MAX = 100;

// What the editor remembers claiming, per page: plenty for any session, and a bound on the memory.
export const IMAGE_CLAIMS_REMEMBERED_MAX = 2_000;

// The gallery images a set of element ops places: each added or updated image element's picture, once each, in order.
export function placedImageIds(ops: readonly unknown[]): string[] {
  const ids = new Set<string>();
  for (const op of ops) {
    if (typeof op !== 'object' || op === null) continue;
    const { kind, element } = op as { kind?: unknown; element?: unknown };
    if ((kind !== 'add' && kind !== 'update') || typeof element !== 'object' || element === null)
      continue;
    const { type, imageId } = element as { type?: unknown; imageId?: unknown };
    if (type === 'image' && isGalleryImageId(imageId)) ids.add(imageId);
  }
  return [...ids];
}

// A claim's body: `{ ids }`, 1 to IMAGE_GRANT_IDS_MAX gallery ids, answered distinct. Null for anything else.
export function parseImageGrantIds(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const { ids } = body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > IMAGE_GRANT_IDS_MAX) return null;
  if (!ids.every(isGalleryImageId)) return null;
  return [...new Set(ids)];
}

// The editor's claims: each (item, image) is sent until one claim of it succeeds, then never again on this page.
// A failed claim is not thrown (the placement still goes to the room; the next save that carries the image tries
// again).
export function createImageClaims(rememberedMax = IMAGE_CLAIMS_REMEMBERED_MAX) {
  const claimed = new Set<string>();
  const keyOf = (itemId: string, imageId: string) => `${itemId}\0${imageId}`;
  return {
    async claim(
      itemId: string,
      ids: readonly string[],
      send: (ids: string[]) => Promise<unknown>,
    ): Promise<void> {
      const open = [...new Set(ids)].filter((id) => !claimed.has(keyOf(itemId, id)));
      for (let i = 0; i < open.length; i += IMAGE_GRANT_IDS_MAX) {
        const chunk = open.slice(i, i + IMAGE_GRANT_IDS_MAX);
        try {
          await send(chunk);
        } catch {
          continue;
        }
        if (claimed.size + chunk.length > rememberedMax) claimed.clear();
        for (const id of chunk) claimed.add(keyOf(itemId, id));
      }
    },
  };
}
