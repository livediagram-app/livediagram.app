// What a reference to a gallery image is (docs/specs/009-elements/images.md, "Reference index"):
// a top-level `type: 'image'` element whose `imageId` names a gallery row.
// The SQL twin of this extractor lives in db/image-refs.ts; a parity test
// holds the two to one corpus, because a reference either one misses is an
// image the retention sweep would reap.

// Gallery ids are 36-character UUIDs; the cap keeps a data URI or any other
// stray string from becoming an index key.
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

// Distinct, in document order. Takes `unknown` because the backfill and the
// copy path hand it whatever a stored body parsed to.
export function imageRefIds(elements: unknown): string[] {
  if (!Array.isArray(elements)) return [];
  const ids = new Set<string>();
  for (const el of elements) {
    if (typeof el !== 'object' || el === null) continue;
    const { type, imageId } = el as { type?: unknown; imageId?: unknown };
    if (type === 'image' && isGalleryImageId(imageId)) ids.add(imageId);
  }
  return [...ids];
}

const IMAGE_ID_IN_TEXT = /"imageId"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

// For a body that won't parse: every string after an "imageId" key counts,
// image element or not. Over-counting keeps bytes; under-counting loses them.
export function imageRefIdsFromText(data: string): string[] {
  const ids = new Set<string>();
  for (const match of data.matchAll(IMAGE_ID_IN_TEXT)) {
    const id = match[1];
    if (isGalleryImageId(id)) ids.add(id);
  }
  return [...ids];
}

// A body with no "imageId" key text places no image, so it skips the parse.
export function imageRefIdsFromData(data: string): string[] {
  if (!data.includes('"imageId"')) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return imageRefIdsFromText(data);
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  return imageRefIds((parsed as { elements?: unknown }).elements);
}
