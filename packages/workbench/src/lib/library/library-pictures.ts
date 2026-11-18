// The small copies of a selection's pictures a save sends for its tile's preview (liveworkspace/docs/specs/006-media/
// libraries.md "Pictures"): each gallery picture the item places, read from the picture the editor already shows,
// drawn at most LIBRARY_PICTURE_EDGE on its longest side (smaller for a picture that is a small part of the item), as
// a JPEG on white (the tile's own ground), within LIBRARY_PICTURES_BYTES_MAX together. A picture whose copy can't be
// made, or would go past the budget, is left out: its preview shows its name, as before.

import {
  LIBRARY_PICTURE_EDGE,
  LIBRARY_PICTURES_BYTES_MAX,
  libraryImageIds,
} from '@liveworkspace/media';
import { debugLog } from '../debug-log';

// The pictures a save reads at most: past this, the rest show their names (a tile can't show dozens anyway).
export const LIBRARY_PICTURES_MAX = 12;
// The smallest copy worth drawing.
const MIN_EDGE = 16;
const JPEG_QUALITY = 0.8;

/** Where the editor shows a picture from: a URL for its bytes, given back with `release` when drawn. */
export type LibraryPictureSource = {
  url: (imageId: string) => Promise<string | null>;
  release: (url: string) => void;
};

/** Draws the picture at `url` no larger than `edge` on its longest side, as a JPEG data URL on white. */
export type LibraryPictureEncoder = (url: string, edge: number) => Promise<string | null>;

type Sized = { type?: unknown; imageId?: unknown; width?: unknown; height?: unknown };

const sideOf = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 0);

// The copy's edge for one picture: its share of the item's longest side, so a small picture in a large item stays small.
export function pictureEdge(element: Sized, item: { width: number; height: number }): number {
  const long = Math.max(item.width, item.height);
  const own = Math.max(sideOf(element.width), sideOf(element.height));
  if (long <= 0 || own <= 0) return LIBRARY_PICTURE_EDGE;
  const edge = Math.round((LIBRARY_PICTURE_EDGE * own) / long);
  return Math.min(LIBRARY_PICTURE_EDGE, Math.max(MIN_EDGE, edge));
}

/** The browser's drawing of a picture's copy: decoded through an <img>, drawn on a white canvas, read as a JPEG. */
export const encodePicture: LibraryPictureEncoder = async (url, edge) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= 0) return null;
  const k = Math.min(1, edge / long);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return out.startsWith('data:image/jpeg;base64,') ? out : null;
};

/**
 * The copies to send with a save, by gallery id: one picture at a time, the largest on the item first (so the budget
 * goes to what the tile shows most), each within what is left of LIBRARY_PICTURES_BYTES_MAX.
 */
export async function libraryPictures(
  draft: { width: number; height: number; elements: readonly unknown[] },
  source: LibraryPictureSource,
  encode: LibraryPictureEncoder = encodePicture,
): Promise<Record<string, string>> {
  const ids = new Set(libraryImageIds(draft.elements));
  const edges = new Map<string, number>();
  for (const el of draft.elements as Sized[]) {
    if (el?.type !== 'image' || typeof el.imageId !== 'string' || !ids.has(el.imageId)) continue;
    edges.set(el.imageId, Math.max(edges.get(el.imageId) ?? 0, pictureEdge(el, draft)));
  }
  const order = [...edges.entries()].sort((a, b) => b[1] - a[1]).slice(0, LIBRARY_PICTURES_MAX);
  const out: Record<string, string> = {};
  let bytes = 0;
  for (const [id, edge] of order) {
    let url: string | null = null;
    try {
      url = await source.url(id);
      const copy = url ? await encode(url, edge) : null;
      if (copy && bytes + copy.length <= LIBRARY_PICTURES_BYTES_MAX) {
        out[id] = copy;
        bytes += copy.length;
      }
    } catch (error) {
      debugLog('[library] picture copy failed', { error: String(error) });
    } finally {
      if (url) source.release(url);
    }
  }
  return out;
}
