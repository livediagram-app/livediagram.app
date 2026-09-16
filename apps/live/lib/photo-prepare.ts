import {
  isPhotoAcceptedType,
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE_PX,
} from '@livediagram/api-schema';

// Getting a photograph ready to be read (spec/139 Phase 8).
//
// Three jobs, all of them done BEFORE anything leaves the browser:
//
//  1. Downscale. A modern phone photo is 12 megapixels; the model reads marker
//     handwriting perfectly well at 2048px on the longest edge, and the rest
//     is upload time and model cost for nothing.
//  2. Strip the metadata. A canvas re-encode keeps the pixels and drops
//     EVERYTHING else — including the GPS tag that says which office the wall
//     is in. That is the main reason this step exists at all.
//  3. Honour the orientation flag first, or a portrait photo from a phone
//     arrives on its side and every note is read as a rotated rectangle.
//     `createImageBitmap(file, { imageOrientation: 'from-image' })` applies the
//     EXIF rotation to the pixels, which is exactly what makes dropping the
//     metadata safe.

export type PhotoPrepareError =
  'photo_unsupported_heic' | 'photo_unsupported_type' | 'photo_unreadable' | 'photo_too_large';

export class PhotoPrepareFailed extends Error {
  constructor(readonly reason: PhotoPrepareError) {
    super(reason);
    this.name = 'PhotoPrepareFailed';
  }
}

// The quality is a judgement: 0.85 keeps marker strokes crisp at 2048px while
// roughly halving the bytes of a 0.95 encode.
const JPEG_QUALITY = 0.85;

export const PHOTO_ACCEPT_ATTR = PHOTO_ACCEPTED_TYPES.join(',');

export function photoTypeError(type: string): PhotoPrepareError | null {
  if (isPhotoAcceptedType(type)) return null;
  // Called out separately because it is the single commonest rejection: HEIC
  // is the iPhone default, and "save as JPEG" is advice the author can act on
  // (spec/19 makes the same distinction for uploads).
  if (type === 'image/heic' || type === 'image/heif') return 'photo_unsupported_heic';
  return 'photo_unsupported_type';
}

export type PreparedPhoto = { dataUrl: string; width: number; height: number };

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const typeError = photoTypeError(file.type);
  if (typeError) throw new PhotoPrepareFailed(typeError);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoPrepareFailed('photo_unreadable');
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  // Never UPSCALE: a small photo is already as much detail as there is, and
  // blowing it up would only cost bytes.
  const ratio = longest > PHOTO_MAX_EDGE_PX ? PHOTO_MAX_EDGE_PX / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoPrepareFailed('photo_unreadable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  if (!dataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new PhotoPrepareFailed('photo_unreadable');
  }
  // Check the bytes we are actually about to send, not the ones we were given:
  // the route enforces this cap, and the author should learn here rather than
  // after waiting out an upload that ends in a 413.
  if (decodedBytes(dataUrl) > PHOTO_MAX_BYTES) throw new PhotoPrepareFailed('photo_too_large');

  return { dataUrl, width, height };
}

function decodedBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
