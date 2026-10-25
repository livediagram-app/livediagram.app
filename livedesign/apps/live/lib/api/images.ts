// Image gallery calls (docs/specs/009-elements/images.md): list, upload, delete, usage index, and
// the authenticated blob-URL fetch for rendering.
import type { ImageSummary } from '@livedesign/api-schema';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  apiFetch,
  getWorkbenchConfinement,
} from './core';
import { blobToDataUrl } from '@/lib/blob-data-url';
import { cachedDisplayCopy, displayEdge, releaseShownUrl, shownUrl } from '@/lib/image-display';

// Listing the owner's gallery. Returns null when the server reports
// 503 (R2 not provisioned on this deployment), letting the picker
// hide the gallery tab + the palette hide its Image entry without
// throwing through an error boundary. Other failures still throw.
//
// Deduped: when the editor mounts, both the Current Tab "Images"
// accordion and the lazy ImagePicker (if the user opens it
// immediately) fire this. React Strict Mode in dev doubles every
// effect on top. Without dedup that's 2 to 4 concurrent fetches
// for the same gallery; with it, the second+ callers receive the
// in-flight promise the first one started.
async function _apiListImages(ownerId: string): Promise<ImageSummary[] | null> {
  const res = await apiFetch(`${API_BASE}/images`, {
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 503) return null;
  return expectOk<{ images: ImageSummary[] }>(res, 'list images').then((b) => b.images);
}
export const apiListImages = dedupeInFlight(_apiListImages, (ownerId) => ownerId);

// Upload bytes + index in the gallery. `sha256` and dimensions are
// computed client-side (the picker reads the file into an
// ArrayBuffer, calls crypto.subtle.digest, and decodes width/height
// via a transient <img>); the server independently re-verifies the
// SHA so a forged header can't poison the dedupe key. Returns the
// dedupe flag so the picker can flash "Already in your gallery"
// when the bytes had been uploaded before.
export async function apiUploadImage(
  ownerId: string,
  file: {
    bytes: ArrayBuffer;
    contentType: string;
    sha256: string;
    width: number;
    height: number;
    originalName?: string;
  },
): Promise<{ image: ImageSummary; deduped: boolean }> {
  const headers = new Headers(await apiHeaders(ownerId));
  headers.set('Content-Type', file.contentType);
  headers.set('Content-Length', String(file.bytes.byteLength));
  headers.set('X-Image-Sha256', file.sha256);
  headers.set('X-Image-Width', String(file.width));
  headers.set('X-Image-Height', String(file.height));
  // Percent-encoded: a header holds Latin-1 only, and Headers.set throws on anything past it (a macOS
  // screenshot's narrow space before AM / PM, a Japanese or emoji name), failing the whole upload.
  if (file.originalName)
    headers.set('X-Image-Original-Name', encodeURIComponent(file.originalName));
  const res = await apiFetch(`${API_BASE}/images`, {
    method: 'POST',
    headers,
    body: file.bytes,
  });
  // Goes through the shared `expectOk` like every other call, instead
  // of the bespoke status-string concat this used to do. On failure it
  // throws `ApiError` carrying the worker's `error` token (`gallery_full`,
  // `unsupported_type`, `file_too_large`, …) so the caller can map it to
  // a friendly message rather than show a raw status.
  return expectOk<{ image: ImageSummary; deduped: boolean }>(res, 'upload image');
}

export async function apiDeleteImage(ownerId: string, imageId: string): Promise<void> {
  return apiDelete(`${API_BASE}/images/${encodeURIComponent(imageId)}`, ownerId, {
    action: 'delete image',
    allow404: false,
  });
}

// Fetch the bytes of one image (authenticated) and return a blob
// URL the caller can stick on an `<img>`. The caller gives it back with
// releaseImageBlobUrl when the element unmounts (the URL is shared by
// every view of the same picture, so it is never revoked directly).
// Native `<img>` can't send auth headers, so the fetch-then-blob
// dance is the way every read gets owner / share auth without
// exposing the bytes publicly. Returns null on 404 / 403 / 503 so
// the renderer can show a broken-image placeholder.
// The bytes are the picture as shown (image-display.ts): no larger than `maxEdge` on its longest side,
// this device's display size by default, made once and shared by every view of the same picture.
// Exports read the original (apiFetchImageDataUrl).
export async function apiFetchImageBlobUrl(
  ownerId: string,
  imageId: string,
  opts: { designId?: string; shareCode?: string | null; maxEdge?: number } = {},
): Promise<string | null> {
  const key = [ownerId, imageId, opts.designId ?? '', opts.shareCode ?? ''].join('\0');
  const blob = await cachedDisplayCopy(key, opts.maxEdge ?? displayEdge(), async () => {
    const res = await fetchImage(ownerId, imageId, opts);
    return res ? res.blob() : null;
  });
  return blob ? shownUrl(blob) : null;
}

/** Gives back a URL apiFetchImageBlobUrl handed out. */
export const releaseImageBlobUrl = releaseShownUrl;

// Same authenticated fetch, but as a base64 `data:` URL rather than a blob
// URL. Used by the tab exporters (PNG / SVG / PDF): a data URL stays valid
// when the SVG is downloaded and saved elsewhere (a blob URL would dangle),
// and decodes onto the export canvas without tainting it (same-origin bytes).
// Returns null on 404 / 403 / 503 so the export falls back to a placeholder.
export async function apiFetchImageDataUrl(
  ownerId: string,
  imageId: string,
  opts: { designId?: string; shareCode?: string | null } = {},
): Promise<string | null> {
  const res = await fetchImage(ownerId, imageId, opts);
  if (!res) return null;
  return blobToDataUrl(await res.blob());
}

// The original bytes of one image (a photo page opens a picture whole, docs/specs/031-photo/
// photo-pages.md "Making a photo page"), or null on any non-ok status.
export async function apiFetchImageBlob(
  ownerId: string,
  imageId: string,
  opts: { designId?: string; shareCode?: string | null } = {},
): Promise<Blob | null> {
  const res = await fetchImage(ownerId, imageId, opts);
  return res ? res.blob() : null;
}

// Shared authenticated GET for one image's bytes. Returns the ok Response, or
// null on any non-ok status (the callers map that to a broken / placeholder
// state). Native `<img src>` can't send auth headers, so every read goes
// through this fetch.
async function fetchImage(
  ownerId: string,
  imageId: string,
  opts: { designId?: string; shareCode?: string | null },
): Promise<Response | null> {
  const params = new URLSearchParams();
  // A workbench session reads images by its own design's path only (no owner shortcut).
  const designId = getWorkbenchConfinement()?.designId ?? opts.designId;
  if (designId) params.set('d', designId);
  const url = `${API_BASE}/images/${encodeURIComponent(imageId)}${
    params.toString() ? `?${params.toString()}` : ''
  }`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await apiFetch(url, { headers });
  return res.ok ? res : null;
}
