// Talking to the photo blob store (docs/specs/031-photo/photo-store.md "The routes"): which blobs a
// tab holds, uploading a batch, adopting another tab's, and reading one. An Offline Mode design
// keeps its blobs in this browser instead (offline-blobs.ts), behind the same calls.
import { encodeBlobBatch, type PhotoBlobEntry } from '@livedesign/api-schema';
import { API_BASE, apiFetch, apiHeaders } from '../api/core';
import { isOfflineId } from '../offline/offline-ids';
import { offlineBlobsHeld, offlineGetBlob, offlinePutBlobs } from './offline-blobs';

/** Who is asking and about which design: the request's identity and share code. */
export type PhotoBlobScope = { ownerId: string; designId: string; shareCode: string | null };

export class PhotoBlobError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`photo blobs: ${status}${code ? ` ${code}` : ''}`);
    this.name = 'PhotoBlobError';
    this.status = status;
    this.code = code;
  }
}

const base = (s: PhotoBlobScope, tabId: string) =>
  `${API_BASE}/designs/${encodeURIComponent(s.designId)}/tabs/${encodeURIComponent(tabId)}`;

async function failed(res: Response): Promise<PhotoBlobError> {
  let code: string | null = null;
  try {
    code = ((await res.json()) as { error?: string }).error ?? null;
  } catch {
    // No body to read.
  }
  return new PhotoBlobError(res.status, code);
}

/** Of `ids`, those the tab already holds. */
export async function blobsHeld(
  s: PhotoBlobScope,
  tabId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  if (await isOfflineId(s.designId)) return offlineBlobsHeld(ids);
  const res = await apiFetch(`${base(s, tabId)}/photo-blobs-held`, {
    method: 'POST',
    headers: await apiHeaders(s.ownerId, { share: s.shareCode, body: true }),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw await failed(res);
  return new Set(((await res.json()) as { has: string[] }).has);
}

/** One batch stored for the tab. */
export async function uploadBlobs(
  s: PhotoBlobScope,
  tabId: string,
  entries: readonly PhotoBlobEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  if (await isOfflineId(s.designId)) return offlinePutBlobs(entries);
  const body = encodeBlobBatch(entries) as Uint8Array<ArrayBuffer>;
  const headers = new Headers(await apiHeaders(s.ownerId, { share: s.shareCode }));
  headers.set('Content-Type', 'application/octet-stream');
  const res = await apiFetch(`${base(s, tabId)}/photo-blobs`, { method: 'POST', headers, body });
  if (!res.ok) throw await failed(res);
}

/** The tab given refs to blobs another tab holds (a duplicated tab, layers pasted across). */
export async function adoptBlobs(
  s: PhotoBlobScope,
  tabId: string,
  from: { designId: string; tabId: string },
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0 || (await isOfflineId(s.designId))) return new Set(ids);
  const res = await apiFetch(`${base(s, tabId)}/photo-blobs-adopt`, {
    method: 'POST',
    headers: await apiHeaders(s.ownerId, { share: s.shareCode, body: true }),
    body: JSON.stringify({ fromDesign: from.designId, fromTab: from.tabId, ids }),
  });
  if (!res.ok) throw await failed(res);
  return new Set(((await res.json()) as { adopted: string[] }).adopted);
}

/** A blob's bytes, or null when the store has none for this tab (yet). */
export async function fetchBlob(
  s: PhotoBlobScope,
  tabId: string,
  id: string,
): Promise<Blob | null> {
  if (await isOfflineId(s.designId)) return offlineGetBlob(id);
  const res = await apiFetch(`${base(s, tabId)}/photo-blobs/${encodeURIComponent(id)}`, {
    headers: await apiHeaders(s.ownerId, { share: s.shareCode }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await failed(res);
  return res.blob();
}
