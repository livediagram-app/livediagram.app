// Image gallery calls (spec/19): list, upload, delete, usage index, and
// the authenticated blob-URL fetch for rendering.
import type { ImageSummary } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, apiDelete, apiHeaders, expectOk } from './core';

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
  const res = await fetch(`${API_BASE}/images`, {
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
  if (file.originalName) headers.set('X-Image-Original-Name', file.originalName);
  const res = await fetch(`${API_BASE}/images`, {
    method: 'POST',
    headers,
    body: file.bytes,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`upload image failed: ${res.status} ${body.error ?? ''}`.trim());
  }
  return res.json() as Promise<{ image: ImageSummary; deduped: boolean }>;
}

export async function apiDeleteImage(ownerId: string, imageId: string): Promise<void> {
  return apiDelete(`${API_BASE}/images/${encodeURIComponent(imageId)}`, ownerId, {
    action: 'delete image',
    allow404: false,
  });
}

// Inverse-index of which diagrams reference each owned image.
// Backs the Explorer Image Gallery's "Used in" badge. Images that
// aren't placed on any canvas yet are absent from the map (treat a
// missing key as "0 uses, safe to delete"). 503 collapses to an
// empty map so a self-host without R2 still renders an empty
// gallery rather than a hard error.
//
// Deduped alongside apiListImages: the GalleryPane fires both in a
// Promise.all on mount, and React Strict Mode doubles the effect.
// The endpoint does a full join + JSON parse per call on the
// server, so squashing concurrent identical fetches matters even
// more than for the cheap list endpoint.
async function _apiImageUsage(
  ownerId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  const res = await fetch(`${API_BASE}/images/usage`, {
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 503) return {};
  return expectOk<{ usage: Record<string, { id: string; name: string }[]> }>(
    res,
    'image usage',
  ).then((b) => b.usage);
}
export const apiImageUsage = dedupeInFlight(_apiImageUsage, (ownerId) => ownerId);

// Fetch the bytes of one image (authenticated) and return a blob
// URL the caller can stick on an `<img>`. The caller is responsible
// for revoking the URL when the element unmounts to prevent leaks.
// Native `<img>` can't send auth headers, so the fetch-then-blob
// dance is the way every read gets owner / share auth without
// exposing the bytes publicly. Returns null on 404 / 403 / 503 so
// the renderer can show a broken-image placeholder.
export async function apiFetchImageBlobUrl(
  ownerId: string,
  imageId: string,
  opts: { diagramId?: string; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.diagramId) params.set('d', opts.diagramId);
  const url = `${API_BASE}/images/${encodeURIComponent(imageId)}${
    params.toString() ? `?${params.toString()}` : ''
  }`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
