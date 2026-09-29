'use client';

import { useEffect, useState } from 'react';
import { apiFetchImageBlobUrl } from '@/lib/api-client';

// Resolve an image's authenticated bytes to a blob URL the caller can
// hang on an `<img src>`. Encapsulates the lifecycle dance that both
// ImageElementView (the canvas renderer) and ImagePicker's gallery
// tiles need to do: fetch via the api client (which threads
// Authorization / X-Owner-Id / X-Share-Code), build a blob URL, and
// revoke it on unmount or when the input changes so the browser
// doesn't leak the underlying Blob.
//
// State machine:
//   { status: 'loading' }    initial + while fetch is in flight.
//   { status: 'ready', src } a usable blob URL.
//   { status: 'broken' }     fetch failed (deleted image, 403, 503).
//   { status: 'idle' }       imageId === null (nothing to load).
//
// Why not return just `string | null`: the picker tile needs to
// distinguish "still loading" (show a skeleton) from "broken"
// (show a broken-image icon) from "no imageId yet" (show the
// upload placeholder). A single `null` couldn't represent all
// three without a sibling boolean, which is exactly what the two
// duplicated useEffect blocks were doing inline.

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; src: string }
  | { status: 'broken' };

// A fetched result, kept with the request it answers so a changed input reads
// as loading at once, never as the previous image.
type Fetched = { key: string; state: State };

export function useImageBlobUrl(
  ownerId: string,
  imageId: string | null,
  opts: { documentId: string; shareCode?: string | null } = { documentId: '' },
): State {
  const { documentId } = opts;
  const shareCode = opts.shareCode ?? null;
  const key = [ownerId, imageId, documentId, shareCode].join('\0');
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    // Nothing to fetch: no image, or an Offline Mode data URI.
    if (!imageId || imageId.startsWith('data:')) return;
    let cancelled = false;
    let activeUrl: string | null = null;
    apiFetchImageBlobUrl(ownerId, imageId, { documentId, shareCode })
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setFetched({ key, state: { status: 'broken' } });
          return;
        }
        activeUrl = url;
        setFetched({ key, state: { status: 'ready', src: url } });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key, state: { status: 'broken' } });
      });
    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [key, ownerId, imageId, documentId, shareCode]);

  if (!imageId) return IDLE;
  // Offline Mode (docs/specs/006-document/offline-mode.md): an embedded image IS its bytes — a base64
  // data URI in imageId. Nothing to fetch and nothing to revoke.
  if (imageId.startsWith('data:')) return { status: 'ready', src: imageId };
  return fetched?.key === key ? fetched.state : LOADING;
}

const IDLE: State = { status: 'idle' };
const LOADING: State = { status: 'loading' };
