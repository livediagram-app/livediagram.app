import { apiFetchDocumentThumbnailUrl } from '@/lib/api-client';

// In-memory cache of diagram snapshot thumbnails (docs/specs/006-document/document-snapshots.md), shared
// by every DiagramThumbnail on the page.
//
// Without it each thumbnail owned its blob URL and revoked it on unmount,
// so switching Explorer views, folders or routes threw every preview away
// and the next mount went back to the network (at best the browser's HTTP
// cache) and re-decoded it, showing the loader in between. Keyed by the
// same inputs the thumbnail fetches for (viewer, diagram, version, share
// code), so an edited diagram's new `savedAt` is a new key and never
// reads the old picture.
//
// A "no snapshot" answer is cached too: it is version-keyed like the
// picture, so it cannot change until the diagram does. A thrown fetch
// (network error) is not, so the next mount retries it.

export type ThumbnailEntry =
  { status: 'ready'; src: string; backgroundColor: string | null } | { status: 'broken' };

export type ThumbnailRequest = {
  ownerId: string;
  documentId: string;
  version: number;
  shareCode: string | null;
};

// Enough for a full Explorer grid, its folder mosaics and a Timeline feed,
// while bounding the blob URLs held: each is a few KB to a few hundred KB
// of SVG text. Evicted least recently used.
export const THUMBNAIL_CACHE_MAX = 200;

const entries = new Map<string, ThumbnailEntry>();
const inflight = new Map<string, Promise<ThumbnailEntry>>();

export function thumbnailKey(req: ThumbnailRequest): string {
  return JSON.stringify([req.ownerId, req.documentId, req.version, req.shareCode]);
}

// A settled entry, if there is one. Pure (no recency bump), so a render
// can call it.
export function peekThumbnail(key: string): ThumbnailEntry | undefined {
  return entries.get(key);
}

// The entry for `req`, fetching it at most once however many thumbnails
// ask at the same time (a diagram in both Recent and a folder mosaic).
export function loadThumbnail(req: ThumbnailRequest): Promise<ThumbnailEntry> {
  const key = thumbnailKey(req);
  const hit = entries.get(key);
  if (hit) {
    remember(key, hit);
    return Promise.resolve(hit);
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = apiFetchDocumentThumbnailUrl(req.ownerId, req.documentId, {
    version: req.version,
    shareCode: req.shareCode,
  })
    .then((result): ThumbnailEntry => {
      const entry: ThumbnailEntry = result
        ? { status: 'ready', src: result.url, backgroundColor: result.backgroundColor }
        : { status: 'broken' };
      remember(key, entry);
      return entry;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

function remember(key: string, entry: ThumbnailEntry) {
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > THUMBNAIL_CACHE_MAX) {
    const [oldest, evicted] = entries.entries().next().value!;
    entries.delete(oldest);
    // An <img> that already decoded this URL keeps its pixels; only a
    // fresh mount would miss it, and that mount refetches.
    if (evicted.status === 'ready') URL.revokeObjectURL(evicted.src);
  }
}

// Tests only: start each case from an empty cache.
export function resetThumbnailCache() {
  for (const entry of entries.values()) {
    if (entry.status === 'ready') URL.revokeObjectURL(entry.src);
  }
  entries.clear();
  inflight.clear();
}
