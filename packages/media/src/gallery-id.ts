// What names a gallery image (liveworkspace/docs/specs/006-media/media.md; each product's docs/specs/009-elements/images.md
// "Reference index"): the media service's id, a string, never an Offline Mode `data:` URI, which holds the bytes
// themselves and names no row. Shared by the apps' reference index (@liveworkspace/api-kit/image-refs) and the
// placement claims an editor sends (./placement-claims.ts).

// Gallery ids are 36-character UUIDs; the cap keeps a data URI or any other stray string from becoming a key.
export const IMAGE_REF_ID_MAX_LENGTH = 128;

// Offline Mode embeds bytes in the element as a data URI, which names no row.
const DATA_URI_PREFIX = 'data:';

export function isGalleryImageId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= IMAGE_REF_ID_MAX_LENGTH &&
    !value.startsWith(DATA_URI_PREFIX)
  );
}
