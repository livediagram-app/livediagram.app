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

export function useImageBlobUrl(
  ownerId: string,
  imageId: string | null,
  opts: { diagramId: string; shareCode?: string | null } = { diagramId: '' },
): State {
  const [state, setState] = useState<State>(imageId ? { status: 'loading' } : { status: 'idle' });

  useEffect(() => {
    if (!imageId) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let activeUrl: string | null = null;
    setState({ status: 'loading' });
    apiFetchImageBlobUrl(ownerId, imageId, {
      diagramId: opts.diagramId,
      shareCode: opts.shareCode ?? null,
    })
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setState({ status: 'broken' });
          return;
        }
        activeUrl = url;
        setState({ status: 'ready', src: url });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'broken' });
      });
    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [ownerId, imageId, opts.diagramId, opts.shareCode]);

  return state;
}
