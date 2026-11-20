// Unused after a delete (liveworkspace/docs/specs/006-media/media.md "Unused after a delete"): an editor that has just
// deleted image elements asks which of their pictures nothing but its own item still uses, so it can offer to delete
// them from storage too. The service answers from its own tables (`GET /app/unused?owner=&document=&ids=`), each app's
// api passes it on (`GET /api/images/unused?d=&ids=`). This file is the wire rule all three share: the cap, the list's
// form in a query string, and its parse.

import { isGalleryImageId } from './gallery-id';

// Pictures one ask carries: far more than one delete removes, and a bound on the query string.
export const UNUSED_IMAGE_IDS_MAX = 50;

/** `GET /app/unused` and `GET /api/images/unused`: the asked ids nothing but the item uses. */
export type MediaUnusedResponse = { unused: string[] };

/** The ids as the query string carries them: distinct gallery ids, at most the cap, comma-joined. */
export function unusedImageIdsParam(ids: Iterable<string>): string {
  const out: string[] = [];
  for (const id of new Set(ids)) {
    if (!isGalleryImageId(id) || id.includes(',')) continue;
    out.push(id);
    if (out.length === UNUSED_IMAGE_IDS_MAX) break;
  }
  return out.join(',');
}

/** The `ids` query value: 1 to the cap of gallery ids, comma-joined, answered distinct. Null for anything else. */
export function parseUnusedImageIds(raw: string | null): string[] | null {
  if (!raw) return null;
  const ids = raw.split(',');
  if (ids.length > UNUSED_IMAGE_IDS_MAX || !ids.every(isGalleryImageId)) return null;
  return [...new Set(ids)];
}
