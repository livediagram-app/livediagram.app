import { sha256Hex, type ImageSummary } from '@livediagram/api-schema';
import { ApiError, apiUploadImage } from './api-client';
import { isOfflineIdSync } from './offline/offline-store';

// Map the api worker's upload error tokens (responses.ts / images.ts)
// to messages safe to render inline in the picker. The client-side
// gate below already pre-rejects bad type / oversize files, so these
// fire on the races it can't see — most importantly `gallery_full`,
// the per-owner cap that only the server knows about (spec/19).
const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  gallery_full: 'Your image gallery is full. Delete some images and try again.',
  unsupported_type: 'Unsupported file type. Use PNG, JPEG, WebP, or GIF.',
  file_too_large: `Too large. Limit is ${(10 * 1024 * 1024) / (1024 * 1024)} MB.`,
  images_unavailable: 'Image uploads are not available on this server.',
};

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

// The shared client-side gate (type / size / non-empty), used by both
// the upload and the offline-embed paths so they reject identically.
function validateImageFile(file: File): void {
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
}

// Runs the full upload flow for one file picked by the user (via
// drop, paste, or file input). Returns the uploaded image + the
// dedupe flag the picker uses to flash "already in your gallery".
export async function uploadImageFile(ownerId: string, file: File): Promise<UploadResult> {
  validateImageFile(file);
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
    const mapped = e instanceof ApiError && e.code ? UPLOAD_ERROR_MESSAGES[e.code] : undefined;
    if (mapped) throw new ImageUploadError(mapped);
    const raw = e instanceof Error ? e.message : 'Upload failed.';
    throw new ImageUploadError(raw);
  }
}

// Offline Mode (spec/76): an offline diagram must stay self-contained, so
// instead of uploading to the server gallery the file is embedded straight
// into the element as a base64 data URI (the renderer and the exporters
// treat a data-URI imageId as the bytes themselves, the same shape Take
// Offline produces). The returned "summary" mirrors the upload result so
// callers stay agnostic: `id` IS the data URI.
async function embedImageFile(file: File): Promise<UploadResult> {
  validateImageFile(file);
  const dims = await readImageDimensions(file);
  if (!dims) {
    throw new ImageUploadError('Could not read image dimensions.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageUploadError('Could not read the file.'));
    reader.readAsDataURL(file);
  });
  return {
    image: {
      id: dataUrl,
      contentType: file.type,
      byteSize: file.size,
      width: dims.width,
      height: dims.height,
      originalName: file.name || undefined,
      createdAt: Date.now(),
    },
    deduped: false,
  };
}

// The single entry point for "the user handed the editor an image file for
// THIS diagram" (picker upload, drag-drop, clipboard paste): cloud diagrams
// upload to the gallery, offline diagrams embed locally so no server copy
// is created for a diagram the server doesn't know about. The offline id
// cache is warm whenever an offline diagram is open, so the sync check is
// reliable here.
export async function addImageFileForDiagram(
  ownerId: string,
  diagramId: string | null,
  file: File,
): Promise<UploadResult> {
  if (diagramId && isOfflineIdSync(diagramId)) return embedImageFile(file);
  return uploadImageFile(ownerId, file);
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
