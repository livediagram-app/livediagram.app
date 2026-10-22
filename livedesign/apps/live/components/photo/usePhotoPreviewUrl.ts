'use client';

// A photo's preview as an object URL (docs/specs/031-photo/photo-store.md "Previews"), fetched once
// per preview and kept for the few most recently shown, so a page scrolled back to shows at once.
import { useEffect, useState } from 'react';
import { fetchBlob, type PhotoBlobScope } from '@/lib/photo-editor/blob-client';

// Previews kept as object URLs (each up to 2048 px a side, encoded): the pages of a tab or two.
export const PREVIEW_URL_CACHE = 12;

const urls = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

function keep(id: string, url: string): void {
  urls.delete(id);
  urls.set(id, url);
  for (const [key, old] of urls) {
    if (urls.size <= PREVIEW_URL_CACHE) break;
    urls.delete(key);
    URL.revokeObjectURL(old);
  }
}

/** The preview's object URL, made here (the session's own blob) or fetched. */
export function previewUrlFor(
  scope: PhotoBlobScope,
  tabId: string,
  id: string,
  own?: Blob,
): Promise<string | null> {
  const hit = urls.get(id);
  if (hit) return Promise.resolve(hit);
  const inFlight = loading.get(id);
  if (inFlight) return inFlight;
  const p = (own ? Promise.resolve(own) : fetchBlob(scope, tabId, id))
    .then((blob) => {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      keep(id, url);
      return url;
    })
    .catch((err: unknown) => {
      console.warn('[photo] preview-missing', { id, error: String(err) });
      return null;
    })
    .finally(() => loading.delete(id));
  loading.set(id, p);
  return p;
}

export function usePhotoPreviewUrl(
  scope: PhotoBlobScope | null,
  tabId: string,
  id: string | undefined,
  own?: (id: string) => Blob | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(id ? (urls.get(id) ?? null) : null);
  useEffect(() => {
    if (!id || !scope) {
      setUrl(null);
      return;
    }
    let live = true;
    void previewUrlFor(scope, tabId, id, own?.(id)).then((u) => {
      // A newer preview keeps the older one showing until it has loaded.
      if (live && u) setUrl(u);
    });
    return () => {
      live = false;
    };
    // The scope's identity changes with each render; its values do not here.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [id, tabId, scope?.documentId]);
  return url;
}
