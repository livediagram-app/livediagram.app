// What a reference to a gallery image is (docs/specs/009-elements/images.md, "Reference index"):
// a top-level `type: 'image'` element whose `imageId` names a gallery row, or a top-level
// Page whose `background.fill` is a picture (`kind: 'image'`) naming one
// (docs/specs/007-editor/pages-mode.md "Image backgrounds").
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

// A page's picture id, when its background is one.
function pageImageId(page: unknown): unknown {
  if (typeof page !== 'object' || page === null) return undefined;
  const background = (page as { background?: unknown }).background;
  if (typeof background !== 'object' || background === null) return undefined;
  const fill = (background as { fill?: unknown }).fill;
  if (typeof fill !== 'object' || fill === null) return undefined;
  const { kind, imageId } = fill as { kind?: unknown; imageId?: unknown };
  return kind === 'image' ? imageId : undefined;
}

// Distinct, in document order: the elements' images, then the pages' pictures. Takes `unknown`
// because the backfill and the copy path hand it whatever a stored body parsed to.
export function imageRefIds(elements: unknown, pages?: unknown): string[] {
  const ids = new Set<string>();
  if (Array.isArray(elements)) {
    for (const el of elements) {
      if (typeof el !== 'object' || el === null) continue;
      const { type, imageId } = el as { type?: unknown; imageId?: unknown };
      if (type === 'image' && isGalleryImageId(imageId)) ids.add(imageId);
    }
  }
  if (Array.isArray(pages)) {
    for (const page of pages) {
      const imageId = pageImageId(page);
      if (isGalleryImageId(imageId)) ids.add(imageId);
    }
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
  const body = parsed as { elements?: unknown; pages?: unknown };
  return imageRefIds(body.elements, body.pages);
}
