// A photo's preview (docs/specs/031-photo/photo-store.md "Previews"): its composite flattened to at
// most PHOTO_PREVIEW_MAX px a side, made a moment after the last commit and kept beside its pixels.
// Every photo page out of focus, the Explorer thumbnail and the server's views draw it. The composite
// is worked band by band, yielding between bands, so a large photo never holds the page still; the
// encode is the worker's.
import { sniffsAs, type PhotoBlobEntry } from '@livedesign/api-schema';
import {
  blobIdOf,
  compositePhoto,
  createRaster,
  PHOTO_PREVIEW_MAX,
  type Photo,
  type PixelsLookup,
  type Raster,
} from '@livedesign/photo-engine';
import { photoWorkers } from './photo-worker-client';
import { rasterizeText } from './text-raster';

// Photo rows composited at a time (a band of tiles), between yields.
export const PREVIEW_BAND_ROWS = 256;

const yieldToPage = () => new Promise<void>((r) => setTimeout(r, 0));

/** The preview's size for a photo: its own when small enough, else scaled to fit, keeping its shape. */
export function previewSize(photo: { width: number; height: number }): {
  width: number;
  height: number;
} {
  const k = Math.min(1, PHOTO_PREVIEW_MAX / Math.max(photo.width, photo.height));
  return {
    width: Math.max(1, Math.round(photo.width * k)),
    height: Math.max(1, Math.round(photo.height * k)),
  };
}

/** The composite scaled down to the preview's size, by averaging (a box filter), band by band.
 *  `cancelled` is asked between bands: a newer commit makes this one moot. */
export async function previewRaster(
  photo: Photo,
  pixels: PixelsLookup,
  cancelled: () => boolean = () => false,
): Promise<Raster | null> {
  const out = previewSize(photo);
  const sx = photo.width / out.width;
  const sy = photo.height / out.height;
  const sums = new Float64Array(out.width * out.height * 4);
  const counts = new Float64Array(out.width * out.height);
  for (let y0 = 0; y0 < photo.height; y0 += PREVIEW_BAND_ROWS) {
    if (cancelled()) return null;
    const rows = Math.min(PREVIEW_BAND_ROWS, photo.height - y0);
    const band = compositePhoto(
      photo,
      pixels,
      { x: 0, y: y0, width: photo.width, height: rows },
      { text: rasterizeText },
    );
    for (let y = 0; y < rows; y++) {
      const oy = Math.min(out.height - 1, Math.floor((y0 + y) / sy));
      for (let x = 0; x < photo.width; x++) {
        const ox = Math.min(out.width - 1, Math.floor(x / sx));
        const i = (y * photo.width + x) * 4;
        const o = oy * out.width + ox;
        // Weighted by alpha, so a transparent pixel adds no colour.
        const a = band.data[i + 3]!;
        sums[o * 4] = sums[o * 4]! + band.data[i]! * a;
        sums[o * 4 + 1] = sums[o * 4 + 1]! + band.data[i + 1]! * a;
        sums[o * 4 + 2] = sums[o * 4 + 2]! + band.data[i + 2]! * a;
        sums[o * 4 + 3] = sums[o * 4 + 3]! + a;
        counts[o] = counts[o]! + 1;
      }
    }
    await yieldToPage();
  }
  const r = createRaster(out.width, out.height);
  for (let o = 0; o < counts.length; o++) {
    const a = sums[o * 4 + 3]!;
    if (!a) continue;
    r.data[o * 4] = sums[o * 4]! / a;
    r.data[o * 4 + 1] = sums[o * 4 + 1]! / a;
    r.data[o * 4 + 2] = sums[o * 4 + 2]! / a;
    r.data[o * 4 + 3] = a / counts[o]!;
  }
  return r;
}

/** The preview encoded (WebP where the browser writes it, else PNG) and named. */
export async function encodePreview(r: Raster): Promise<PhotoBlobEntry | null> {
  const res = await photoWorkers().run({
    kind: 'encode',
    width: r.width,
    height: r.height,
    data: new Uint8ClampedArray(r.data),
    type: 'image/webp',
    quality: 0.85,
  }).result;
  if (res.kind !== 'encode') return null;
  // A browser that cannot write WebP answers PNG instead.
  const type = sniffsAs(res.bytes, 'image/webp') ? 'image/webp' : 'image/png';
  return { id: await blobIdOf(res.bytes), type, bytes: res.bytes };
}
