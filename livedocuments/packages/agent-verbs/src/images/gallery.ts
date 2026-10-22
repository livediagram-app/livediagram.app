// The user's image gallery as an agent reads it (docs/specs/009-elements/images.md "Agents"): the listing the MCP's
// list_images and the CLI's `image ls` answer, and the image ids a write would place, so the MCP can refuse one the
// caller's gallery does not hold. Pure: the callers read the gallery (GET /api/images).
import type { ImageSummary } from '@livedocuments/api-schema';

export const IMAGE_LIST_DEFAULT_LIMIT = 20;
export const IMAGE_LIST_MAX_LIMIT = 50;
// The contact sheet draws at most this many, so its picture stays legible and its bytes bounded.
export const CONTACT_SHEET_MAX = 12;

// Type aliases, not interfaces, so a listing is a plain structured value the MCP can answer with.
export type GalleryImage = {
  id: string;
  name: string;
  width: number;
  height: number;
  size: number;
  uploadedAt: string;
};

type GalleryListing = {
  images: GalleryImage[];
  more: number;
};

// The name an image is listed by: its file's name, or, for one uploaded without, its type and id.
export function imageName(image: ImageSummary): string {
  if (image.originalName?.trim()) return image.originalName.trim();
  const ext = image.contentType.split('/')[1] ?? 'image';
  return `(unnamed ${ext} ${image.id.slice(0, 8)})`;
}

// The gallery newest first, those whose name holds `query` (any case), at most `limit`.
export function galleryListing(
  images: readonly ImageSummary[],
  {
    query,
    limit = IMAGE_LIST_DEFAULT_LIMIT,
  }: { query?: string | undefined; limit?: number | undefined },
): GalleryListing {
  const q = query?.trim().toLowerCase();
  const matched = [...images]
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((i) => !q || imageName(i).toLowerCase().includes(q));
  return {
    images: matched.slice(0, limit).map((i) => ({
      id: i.id,
      name: imageName(i),
      width: i.width,
      height: i.height,
      size: i.byteSize,
      uploadedAt: new Date(i.createdAt).toISOString(),
    })),
    more: Math.max(0, matched.length - limit),
  };
}

interface PlacedImage {
  // The element that places it, when the input names one.
  elementId: string | null;
  imageId: string;
}

// Every image id a tool's input places, wherever it sits (a tab's elements, an op's element or its set): each object
// carrying a string `imageId`, with the element id beside it. The input is what the model sent, walked once.
export function imagesPlacedIn(input: unknown): PlacedImage[] {
  const out: PlacedImage[] = [];
  const walk = (value: unknown, elementId: string | null) => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v, elementId);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const rec = value as Record<string, unknown>;
    const here =
      typeof rec.id === 'string'
        ? rec.id
        : typeof rec.elementId === 'string'
          ? rec.elementId
          : elementId;
    if (typeof rec.imageId === 'string' && rec.imageId)
      out.push({ elementId: here, imageId: rec.imageId });
    for (const [key, v] of Object.entries(rec)) if (key !== 'imageId') walk(v, here);
  };
  walk(input, null);
  return out;
}

// Why a placed image cannot be written, as a sentence; null when the gallery holds every one.
export function unknownImageIssue(
  placed: readonly PlacedImage[],
  gallery: ReadonlySet<string>,
): string | null {
  const missing = placed.find((p) => !gallery.has(p.imageId));
  if (!missing) return null;
  const where = missing.elementId ? ` on element "${missing.elementId}"` : '';
  return (
    `imageId ${JSON.stringify(missing.imageId)}${where} is not in your image gallery: ` +
    'list_images lists the pictures you can place. Leave imageId out for a placeholder the user fills in the editor.'
  );
}
