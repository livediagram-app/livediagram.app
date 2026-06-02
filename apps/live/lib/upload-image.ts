import { sha256Hex, type ImageSummary } from '@livediagram/api-schema';
import { apiUploadImage } from './api-client';

// Shared client-side file → /api/images upload flow. Called from
// the editor's ImagePicker AND from the Explorer Image Gallery so
// the validation rules (accepted types, size cap, dimension read,
// SHA-256 hashing) live in one place. The api worker re-runs all
// of these checks server-side; this client-side gate is purely
// UX-shaped (fast feedback before a big upload + a sensible error
// message), not security.

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
const MAX_BYTES = 10 * 1024 * 1024;

export const UPLOAD_ACCEPT_ATTR = ACCEPTED_TYPES.join(',');
export const UPLOAD_MAX_BYTES = MAX_BYTES;

export type UploadResult = { image: ImageSummary; deduped: boolean };

// Thrown for any user-facing validation / upload failure. The
// `message` is safe to render verbatim in the UI (the picker shows
// it inline). Network + server errors get caught + re-thrown with
// a friendlier message by the wrapping helper so the caller can
// surface a single field.
export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

// Runs the full upload flow for one file picked by the user (via
// drop, paste, or file input). Returns the uploaded image + the
// dedupe flag the picker uses to flash "already in your gallery".
export async function uploadImageFile(ownerId: string, file: File): Promise<UploadResult> {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    throw new ImageUploadError(
      'Unsupported file type. Use PNG, JPEG, WebP, or GIF (SVG is rejected for security).',
    );
  }
  if (file.size > MAX_BYTES) {
    throw new ImageUploadError(`Too large. Limit is ${MAX_BYTES / (1024 * 1024)} MB.`);
  }
  if (file.size === 0) {
    throw new ImageUploadError('Empty file.');
  }
  const bytes = await file.arrayBuffer();
  // SHA-256 dedupe key. The server re-verifies this against the
  // body so a client can't poison the gallery with a fake hash.
  // Shared with the api worker via @livediagram/api-schema so
  // both sides produce byte-for-byte identical hex.
  const sha = await sha256Hex(bytes);
  const dims = await readImageDimensions(file);
  if (!dims) {
    throw new ImageUploadError('Could not read image dimensions.');
  }
  try {
    return await apiUploadImage(ownerId, {
      bytes,
      contentType: file.type,
      sha256: sha,
      width: dims.width,
      height: dims.height,
      originalName: file.name,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Upload failed.';
    throw new ImageUploadError(raw);
  }
}

// Decode width / height via a transient <img>. The browser parses
// the bytes off the main thread; we throw away the blob URL on
// either success or error so we don't leak memory.
function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
