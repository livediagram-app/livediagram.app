import {
  CROP_MAX_BYTES,
  CROP_MAX_EDGE_PX,
  isPhotoAcceptedType,
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_EDGE_PX,
  PHOTO_MAX_NOTES,
  type NoteCrop,
} from '@livediagram/api-schema';
import { cropRects, detectStickies, type DetectedSticky } from '@livediagram/sticky-vision';

// Getting a photograph ready to become notes (spec/139 Phase 8) — all of it in
// the browser.
//
// The photo itself never leaves the machine. It is decoded here, the stickies
// are FOUND here, and only the crops — one sticky each — are handed to the
// caller to send. Four jobs, in order:
//
//  1. Decode honouring the EXIF orientation flag, or a portrait photo from a
//     phone arrives on its side and every note is a rotated rectangle.
//  2. Detect on a downscaled working copy: 2048px on the longest edge is more
//     than the detector needs and a fraction of the pixels to walk.
//  3. Cut each sticky out of the FULL-resolution bitmap, so the model gets the
//     sharpest pixels of the handwriting rather than the working copy's.
//  4. Re-encode each crop as a small JPEG — which drops EXIF with it, after
//     the orientation has already been applied.

export type PhotoDetectError =
  'photo_unsupported_heic' | 'photo_unsupported_type' | 'photo_unreadable' | 'crops_too_large';

export class PhotoDetectFailed extends Error {
  constructor(readonly reason: PhotoDetectError) {
    super(reason);
    this.name = 'PhotoDetectFailed';
  }
}

// Crisp enough for marker handwriting, small enough that sixteen of them are a
// modest request.
const JPEG_QUALITY = 0.85;

export const PHOTO_ACCEPT_ATTR = PHOTO_ACCEPTED_TYPES.join(',');

export function photoTypeError(type: string): PhotoDetectError | null {
  if (isPhotoAcceptedType(type)) return null;
  // Called out separately because it is the single commonest rejection: HEIC
  // is the iPhone default, and "save as JPEG" is advice the author can act on
  // (spec/19 makes the same distinction for uploads).
  if (type === 'image/heic' || type === 'image/heif') return 'photo_unsupported_heic';
  return 'photo_unsupported_type';
}

export type PhotoDetection = {
  // Where each sticky is, in WORKING-image pixels.
  stickies: DetectedSticky[];
  // One crop per sticky, ready to send. Same ids.
  crops: NoteCrop[];
  // The working image's size, for normalising the boxes.
  imageSize: { width: number; height: number };
};

export async function detectAndCrop(
  file: File,
  opts: { signal?: AbortSignal } = {},
): Promise<PhotoDetection> {
  const typeError = photoTypeError(file.type);
  if (typeError) throw new PhotoDetectFailed(typeError);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoDetectFailed('photo_unreadable');
  }
  if (opts.signal?.aborted) throw new PhotoDetectFailed('photo_unreadable');

  const longest = Math.max(bitmap.width, bitmap.height);
  // Never UPSCALE: a small photo already holds as much detail as there is.
  const ratio = longest > PHOTO_MAX_EDGE_PX ? PHOTO_MAX_EDGE_PX / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const working = drawTo(bitmap, width, height);
  const stickies = detectStickies(working.image).slice(0, PHOTO_MAX_NOTES);
  if (stickies.length === 0) {
    bitmap.close?.();
    return { stickies, crops: [], imageSize: { width, height } };
  }

  // Back up to the full-resolution bitmap to cut: 1 / ratio is exactly how far.
  const rects = cropRects(stickies, 1 / ratio);
  const crops: NoteCrop[] = [];
  for (const rect of rects) {
    if (opts.signal?.aborted) break;
    const image = encodeCrop(bitmap, rect);
    if (!image) continue;
    if (decodedBytes(image) > CROP_MAX_BYTES) throw new PhotoDetectFailed('crops_too_large');
    crops.push({ id: rect.id, image });
  }
  bitmap.close?.();
  return { stickies, crops, imageSize: { width, height } };
}

function drawTo(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): { image: { width: number; height: number; data: Uint8ClampedArray } } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new PhotoDetectFailed('photo_unreadable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { image: { width, height, data } };
}

function encodeCrop(
  bitmap: ImageBitmap,
  rect: { x: number; y: number; w: number; h: number },
): string | null {
  const w = Math.min(rect.w, bitmap.width - rect.x);
  const h = Math.min(rect.h, bitmap.height - rect.y);
  if (w <= 0 || h <= 0) return null;
  const scale = Math.min(1, CROP_MAX_EDGE_PX / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, rect.x, rect.y, w, h, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return url.startsWith('data:image/jpeg;base64,') ? url : null;
}

function decodedBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
