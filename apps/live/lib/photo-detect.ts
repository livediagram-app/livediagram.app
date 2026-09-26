import {
  CROP_MAX_BYTES,
  CROP_MAX_EDGE_PX,
  isPhotoAcceptedType,
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_EDGE_PX,
  PHOTO_MAX_NOTES,
  type NoteCrop,
} from '@livediagram/api-schema';
import {
  cropRects,
  detectStickies,
  HYBRID_RULES,
  workingSizeOf,
  type DetectedSticky,
  type ModelCues,
} from '@livediagram/sticky-vision';
import { isFlatImage } from '@livediagram/sticky-model';
import { boundaryCuesFor } from './photo-model/client';
import type { BoundaryBackend, BoundaryOutcome, ClassicalReason } from './photo-model/protocol';

// Getting a photograph ready to become notes (spec/139 Phase 8) — all of it in
// the browser.
//
// The photo itself never leaves the machine. It is decoded here, the stickies
// are FOUND here, and only the crops — one sticky each — are handed to the
// caller to send. Four jobs, in order:
//
//  1. Decode honouring the EXIF orientation flag, or a portrait photo from a
//     phone arrives on its side and every note is a rotated rectangle.
//  2. Detect on a downscaled working copy, PHOTO_MAX_EDGE_PX on the longest
//     edge: where the detector scores best, and a fraction of the pixels. The
//     boundary model (a worker, loaded on demand) reads the same copy first,
//     and the detector takes its corrections; without it, for any reason,
//     the classical detector runs alone. A flat drawing (a screenshot, a
//     drawn wall) is not asked of the model at all: it learnt photographs,
//     and reads a flat note as background.
//  3. Cut each sticky out of the FULL-resolution bitmap, so the model gets the
//     sharpest pixels of the handwriting rather than the working copy's.
//  4. Re-encode each crop as a small JPEG — which drops EXIF with it, after
//     the orientation has already been applied.

export type PhotoDetectError =
  'photo_unsupported_heic' | 'photo_unsupported_type' | 'photo_unreadable' | 'crops_too_large';

export class PhotoDetectFailed extends Error {
  readonly reason: PhotoDetectError;

  constructor(reason: PhotoDetectError) {
    super(reason);
    this.reason = reason;
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

// Which detector found the boxes, and on what: the hybrid on a backend, or the
// classical detector alone and why. Closed values, logged and counted.
export type PhotoDetector =
  { path: 'hybrid'; backend: BoundaryBackend } | { path: 'classical'; reason: ClassicalReason };

export type PhotoDetection = {
  detector: PhotoDetector;
  // Where each sticky is, in WORKING-image pixels.
  stickies: DetectedSticky[];
  // One crop per sticky, ready to send. Same ids.
  crops: NoteCrop[];
  // The working image's size, for normalising the boxes.
  imageSize: { width: number; height: number };
  // A JPEG of the WORKING image, for the review overlay to draw the boxes on.
  // Held in memory only — never stored, never sent, and it drops EXIF with it.
  photoUrl: string;
  // The WORKING image's raw RGBA, so a box the author draws over a missed
  // sticky can have its paper colour classified in the browser. In memory only.
  imageData: Uint8ClampedArray;
  // Notes found beyond PHOTO_MAX_NOTES and left out. Said out loud in the
  // review: a silent cut keeps the first notes in READING order, so what goes
  // missing is the whole far end of the wall.
  dropped: number;
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

  // The one working-size rule, shared with the calibration sweep so the sweep
  // scores the image the editor detects on. Never upscales.
  const {
    width,
    height,
    scale: ratio,
  } = workingSizeOf(bitmap.width, bitmap.height, PHOTO_MAX_EDGE_PX);

  const working = drawTo(bitmap, width, height);
  const { detector, model } = await boundaryModelFor(working.image);
  const found = detectStickies(working.image, model ? { model } : {});
  const stickies = found.slice(0, PHOTO_MAX_NOTES);
  const dropped = found.length - stickies.length;
  if (stickies.length === 0) {
    bitmap.close?.();
    return {
      stickies,
      crops: [],
      imageSize: { width, height },
      photoUrl: working.dataUrl,
      imageData: working.image.data,
      dropped,
      detector,
    };
  }

  // Back up to the full-resolution bitmap to cut: 1 / ratio is exactly how far.
  const crops = cutCrops(bitmap, stickies, 1 / ratio, opts.signal);
  if (crops.some((c) => decodedBytes(c.image) > CROP_MAX_BYTES)) {
    bitmap.close?.();
    throw new PhotoDetectFailed('crops_too_large');
  }
  bitmap.close?.();
  return {
    stickies,
    crops,
    imageSize: { width, height },
    photoUrl: working.dataUrl,
    imageData: working.image.data,
    dropped,
    detector,
  };
}

// One crop per box, cut from the full-resolution bitmap; `scale` takes a box
// from working pixels to the bitmap's.
function cutCrops(
  bitmap: ImageBitmap,
  boxes: DetectedSticky[],
  scale: number,
  signal?: AbortSignal,
): NoteCrop[] {
  const crops: NoteCrop[] = [];
  for (const rect of cropRects(boxes, scale)) {
    if (signal?.aborted) break;
    const image = encodeCrop(bitmap, rect);
    if (image) crops.push({ id: rect.id, image });
  }
  return crops;
}

// Crops for boxes the author moved, resized or drew in the review (spec/139
// Phase 9): the photo is decoded again and each box cut from its FULL
// resolution, exactly as the first read's crops were. `workingSize` is the
// size the boxes are measured in. Never throws: a photo that cannot be decoded,
// or a crop too large to send, is simply not read again.
export async function cropBoxes(
  file: Blob,
  boxes: DetectedSticky[],
  workingSize: { width: number; height: number },
): Promise<NoteCrop[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (err) {
    console.warn('[photo-detect] the photo could not be decoded again for a re-read', String(err));
    return [];
  }
  const crops = cutCrops(bitmap, boxes, bitmap.width / workingSize.width);
  bitmap.close?.();
  return crops.filter((c) => decodedBytes(c.image) <= CROP_MAX_BYTES);
}

// The model's cues for this image, or the reason there are none. Never throws:
// a correction that cannot be had is no reason to fail the import. A flat
// drawing is not asked at all (docs/vision/experiments/o-flat.md).
async function boundaryModelFor(image: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): Promise<{
  detector: PhotoDetector;
  model: { cues: ModelCues; rules: typeof HYBRID_RULES } | null;
}> {
  if (isFlatImage(image)) {
    console.info('[photo-detect] classical (flat-image)');
    return { detector: { path: 'classical', reason: 'flat-image' }, model: null };
  }
  let outcome: BoundaryOutcome;
  try {
    outcome = await boundaryCuesFor(image);
  } catch (err) {
    console.warn('[photo-detect] the boundary model threw; classical only', String(err));
    outcome = { ok: false, reason: 'inference-failed' };
  }
  if (!outcome.ok) {
    console.info(`[photo-detect] classical (${outcome.reason})`);
    return { detector: { path: 'classical', reason: outcome.reason }, model: null };
  }
  console.info(
    `[photo-detect] hybrid (${outcome.backend}, ${outcome.cues.notes.length} model notes)`,
  );
  return {
    detector: { path: 'hybrid', backend: outcome.backend },
    model: { cues: outcome.cues, rules: HYBRID_RULES },
  };
}

function drawTo(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): { image: { width: number; height: number; data: Uint8ClampedArray }; dataUrl: string } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new PhotoDetectFailed('photo_unreadable');
  // ASK FOR A PROPER DOWNSCALE. A phone photo is 4000px wide and the working
  // image is 1000, so this call is throwing away three quarters of the
  // pixels; at the default smoothing quality it does that by sampling rather
  // than averaging, and the result is an aliased, speckled image whose paper
  // edges come apart into fragments. The detector found 21 notes on a photo
  // where the same code, given a properly resampled copy of the same
  // photograph, found 34.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { image: { width, height, data }, dataUrl };
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
