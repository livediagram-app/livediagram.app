// Pictures as the editor shows them (docs/specs/009-elements/images.md "Shown at the size they are
// seen"): an uploaded photo is kept whole for exports, but the canvas, the pages and the gallery show
// a copy no larger than the screen can use. A phone's camera photo decodes to 50-100 MB of pixels, so
// a slide deck of a dozen of them, each drawn a few hundred pixels wide, had the phone close the tab
// for memory. The copy is made once per picture and size, one picture at a time (decoding two large
// photos at once is itself the spike this avoids), and kept for whoever shows the same picture next.

import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// The longest side a picture is shown at: a phone or tablet (a coarse pointer, the devices that run
// out of memory), anything else, and a gallery tile.
export const DISPLAY_EDGE_TOUCH = 2048;
export const DISPLAY_EDGE_DESKTOP = 4096;
export const DISPLAY_EDGE_TILE = 512;
// Copies kept for reuse (most recently asked for first). Each is a compressed file, not pixels.
export const DISPLAY_CACHE_SIZE = 24;
// JPEG quality for a photo's copy; pictures that may be transparent stay PNG.
const JPEG_QUALITY = 0.9;

/** The longest side this device shows a picture at. */
export function displayEdge(): number {
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarse ? DISPLAY_EDGE_TOUCH : DISPLAY_EDGE_DESKTOP;
}

/** The size a picture `width` x `height` is shown at, at most `maxEdge` on its longest side. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (long <= maxEdge) return null;
  const k = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  };
}

// One picture at a time.
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
}

async function encode(
  bitmap: ImageBitmap,
  size: { width: number; height: number },
  type: string,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.convertToBlob({ type, quality: JPEG_QUALITY });
  }
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, JPEG_QUALITY),
  );
  // Let the canvas's pixels go now rather than at collection.
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

/**
 * `blob` as shown: itself when it already fits within `maxEdge` (or cannot be read here, or is a GIF,
 * whose frames a still copy would lose), else a smaller copy of it.
 */
export function displayCopy(blob: Blob, maxEdge: number): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || blob.type === 'image/gif') {
    return Promise.resolve(blob);
  }
  return oneAtATime(async () => {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const size = fitWithin(bitmap.width, bitmap.height, maxEdge);
      if (!size) return blob;
      const type = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const copy = await encode(bitmap, size, type);
      debugLog('[image-display] copy made', {
        from: `${bitmap.width}x${bitmap.height}`,
        to: `${size.width}x${size.height}`,
        bytes: copy?.size ?? null,
      });
      return copy ?? blob;
    } catch (err) {
      debugLog('[image-display] copy failed, showing the original', { err: String(err) });
      return blob;
    } finally {
      bitmap?.close();
    }
  });
}

const cache = new Map<string, Promise<Blob | null>>();

/**
 * The shown copy of the picture `key` names, loading it with `load` the first time (or after it fell
 * out of the cache). A load that finds nothing is not kept, so a later ask tries again.
 */
export function cachedDisplayCopy(
  key: string,
  maxEdge: number,
  load: () => Promise<Blob | null>,
): Promise<Blob | null> {
  const id = `${key}\0${maxEdge}`;
  const held = cache.get(id);
  if (held) {
    cache.delete(id);
    cache.set(id, held);
    return held;
  }
  const made = load().then((blob) => (blob ? displayCopy(blob, maxEdge) : null));
  cache.set(id, made);
  made.then(
    (blob) => {
      if (!blob && cache.get(id) === made) cache.delete(id);
    },
    () => {
      if (cache.get(id) === made) cache.delete(id);
    },
  );
  while (cache.size > DISPLAY_CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return made;
}

// One blob URL per shown copy, however many views show it: the browser decodes per URL, so two
// elements showing the same picture through two URLs held its pixels twice.
const urlOf = new WeakMap<Blob, string>();
const users = new Map<string, { blob: Blob; count: number }>();

/** A URL showing `blob`, shared with every other view of it; give it back with releaseShownUrl. */
export function shownUrl(blob: Blob): string {
  const held = urlOf.get(blob);
  if (held) {
    users.get(held)!.count++;
    return held;
  }
  const url = URL.createObjectURL(blob);
  urlOf.set(blob, url);
  users.set(url, { blob, count: 1 });
  return url;
}

/** Done showing `url`: the last view to give it back lets it go. A URL made elsewhere is revoked. */
export function releaseShownUrl(url: string): void {
  const held = users.get(url);
  if (!held) {
    URL.revokeObjectURL(url);
    return;
  }
  if (--held.count > 0) return;
  users.delete(url);
  urlOf.delete(held.blob);
  URL.revokeObjectURL(url);
}

export function resetDisplayCacheForTests(): void {
  cache.clear();
  users.clear();
  queue = Promise.resolve();
}
