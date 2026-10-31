// The pictures of Image fields (docs/specs/026-plan/item-types.md "Image fields"): an upload for a plan, and the
// authenticated read that hands an `<img>` a blob URL. The bytes live in liveworkspace's media service, behind this
// app's api (`POST /api/images?p=`, `GET /api/images/{id}?p=`), which checks who may upload for a plan and who may
// see what. A This Browser plan uploads into the person's gallery without naming the plan, and reads its pictures
// as their uploader.

import { INDEX_GRANT_HEADER, sha256Hex } from '@liveplanner/api-schema';
import {
  ACCEPTED_IMAGE_TYPES,
  isAcceptedImageType,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  type MediaImage,
} from '@liveworkspace/media';
import {
  cachedDisplayCopy,
  DISPLAY_EDGE_TILE,
  displayEdge,
  releaseShownUrl,
  shownUrl,
} from '@liveworkspace/workbench/lib/image-display';
import { isOfflineId } from '../offline/offline-store';
import {
  API_BASE,
  ApiError,
  apiFetch,
  apiHeaders,
  expectOk,
  getSessionSharePassword,
} from './core';
import { planGrant } from './plan-grants';

/** Which plan a picture is for, and as whom: the ids every plan call carries. */
export type ImagesScope = { ownerId: string; projectId: string; shareCode: string | null };

/** An uploaded picture as the api answers it: its id is what an Image field holds. */
export type ImageSummary = Omit<MediaImage, 'app'>;

/** The file picker's `accept`: the types an upload may be (PNG, JPEG, WebP, GIF; never SVG). */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',');

/** The longest side a card face's thumbnail is fetched at (a 20 px chip, sharp on any screen). */
export const IMAGE_THUMB_EDGE = DISPLAY_EDGE_TILE;

/** The longest side a card's cover is fetched at (docs/specs/026-plan/items.md "Attachments"): a Detailed card is at
 *  most about 320 px wide, so twice that is sharp on any screen. */
export const IMAGE_COVER_EDGE = 640;

/** The longest side an Attachments row's 40 px thumbnail is fetched at. */
export const IMAGE_ROW_EDGE = 160;

/** Why an upload failed, each with the words the card panel shows (docs/specs/026-plan/item-types.md "What it
 *  refuses"). */
export type ImageUploadFailure =
  | 'unsupported_type'
  | 'file_too_large'
  | 'empty_file'
  | 'unreadable'
  | 'gallery_full'
  | 'images_unavailable'
  | 'upload_failed';

export const IMAGE_UPLOAD_MESSAGES: Record<ImageUploadFailure, string> = {
  unsupported_type: 'Use a PNG, JPEG, WebP or GIF image.',
  file_too_large: `That image is over ${MAX_IMAGE_MB} MB.`,
  empty_file: 'That file is empty.',
  unreadable: "That image can't be read.",
  gallery_full: 'Your image gallery is full. Delete some images and try again.',
  images_unavailable: "Image uploads aren't available here.",
  upload_failed: "The image couldn't be uploaded. Try again.",
};

/** A failed upload. `message` is safe to show as it is; `code` says which refusal it was (`images_unavailable`: the
 *  server has no media service, so the control offers no upload). */
export class ImageUploadError extends Error {
  readonly code: ImageUploadFailure;
  constructor(code: ImageUploadFailure) {
    super(IMAGE_UPLOAD_MESSAGES[code]);
    this.name = 'ImageUploadError';
    this.code = code;
  }
}

/** The client-side gate, before anything is sent: the type, the size and an empty file. Throws ImageUploadError.
 *  The api and the service check again; this is for a fast, plain answer while picking. */
export function checkImageFile(file: Blob): void {
  if (!isAcceptedImageType(file.type)) throw new ImageUploadError('unsupported_type');
  if (file.size > MAX_IMAGE_BYTES) throw new ImageUploadError('file_too_large');
  if (file.size === 0) throw new ImageUploadError('empty_file');
}

// The api's refusals the panel words itself; anything else is a failed upload.
const SERVER_FAILURES = new Set<string>([
  'unsupported_type',
  'file_too_large',
  'gallery_full',
  'images_unavailable',
]);

/**
 * Uploads `file` for an Image field of the scope's plan and answers the stored picture (`deduped` when the person
 * had uploaded the same bytes before). Throws ImageUploadError, with the words to show, for every failure.
 */
export async function apiUploadImage(
  scope: ImagesScope,
  file: File,
): Promise<{ image: ImageSummary; deduped: boolean }> {
  checkImageFile(file);
  const bytes = await file.arrayBuffer();
  const size = await imageSize(file);
  if (!size) throw new ImageUploadError('unreadable');
  const local = await isOfflineId(scope.projectId);
  try {
    const headers = await planHeaders(scope, local);
    headers.set('Content-Type', file.type);
    headers.set('Content-Length', String(bytes.byteLength));
    // The service re-hashes the body, so a forged hash can't stand for other bytes.
    headers.set('X-Image-Sha256', await sha256Hex(bytes));
    headers.set('X-Image-Width', String(size.width));
    headers.set('X-Image-Height', String(size.height));
    // Percent-encoded: a header holds Latin-1 only, and Headers.set throws on anything past it.
    if (file.name) headers.set('X-Image-Original-Name', encodeURIComponent(file.name));
    const res = await apiFetch(`${API_BASE}/images${planQuery(scope, local)}`, {
      method: 'POST',
      headers,
      body: bytes,
    });
    return await expectOk<{ image: ImageSummary; deduped: boolean }>(res, 'upload image');
  } catch (err) {
    const code = err instanceof ApiError ? err.code : null;
    throw new ImageUploadError(
      code && SERVER_FAILURES.has(code) ? (code as ImageUploadFailure) : 'upload_failed',
    );
  }
}

/**
 * A blob URL showing picture `imageId` of the scope's plan, or null when it can't be shown (deleted at the service,
 * not shown to this person, or no media service): the control then draws its broken-image tile. The picture is
 * fetched once per size and shared by every card and panel showing it; `maxEdge` is the longest side wanted
 * (IMAGE_THUMB_EDGE for a card face; this device's display size by default). Give the URL back with
 * releaseImageUrl when the element showing it goes.
 */
export async function apiImageUrl(
  scope: ImagesScope,
  imageId: string,
  opts: { maxEdge?: number } = {},
): Promise<string | null> {
  const key = [scope.ownerId, imageId, scope.projectId, scope.shareCode ?? ''].join('\0');
  const blob = await cachedDisplayCopy(key, opts.maxEdge ?? displayEdge(), async () => {
    const local = await isOfflineId(scope.projectId);
    try {
      const res = await apiFetch(
        `${API_BASE}/images/${encodeURIComponent(imageId)}${planQuery(scope, local)}`,
        { headers: await planHeaders(scope, local) },
      );
      return res.ok ? await res.blob() : null;
    } catch {
      // Offline, or a session that can't send: shown as can't be shown, and asked again next time.
      return null;
    }
  });
  return blob ? shownUrl(blob) : null;
}

/**
 * Picture `imageId` of the scope's plan as it was uploaded, for opening or downloading it whole; null when it can't
 * be read. Not cached: it is asked for only when someone opens or saves one.
 */
export async function apiImageOriginal(scope: ImagesScope, imageId: string): Promise<Blob | null> {
  const local = await isOfflineId(scope.projectId);
  try {
    const res = await apiFetch(
      `${API_BASE}/images/${encodeURIComponent(imageId)}${planQuery(scope, local)}`,
      { headers: await planHeaders(scope, local) },
    );
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** Gives back a URL apiImageUrl handed out. */
export const releaseImageUrl = releaseShownUrl;

// The plan a request names: none for a This Browser plan, which the server does not hold.
const planQuery = (scope: ImagesScope, local: boolean) =>
  local ? '' : `?p=${encodeURIComponent(scope.projectId)}`;

// The person's identity and link, and the index's grant on the plan (plan-grants.ts), which apiFetch adds only to
// a /projects/ path: one held grant per plan and link, so a board of pictures asks the index once.
async function planHeaders(scope: ImagesScope, local: boolean): Promise<Headers> {
  const headers = new Headers(await apiHeaders(scope.ownerId, { share: scope.shareCode }));
  if (local) return headers;
  const share = scope.shareCode
    ? { code: scope.shareCode, password: getSessionSharePassword() }
    : null;
  const grant = await planGrant(scope.projectId, share);
  if (grant) headers.set(INDEX_GRANT_HEADER, grant.grant);
  return headers;
}

// The picture's width and height, decoded off the main thread where the browser can, else by a transient <img>.
// Null when it does not decode.
async function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done(null);
    img.src = url;
  });
}
