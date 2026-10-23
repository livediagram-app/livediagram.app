'use client';

import { useEffect, type RefObject } from 'react';
import { loadThumbnail, type ThumbnailRequest } from '@/lib/thumbnail-cache';

// Asks for a design's snapshot as its row nears the viewport, so the Details view's preview
// paints at once from the page's snapshot cache (docs/specs/013-workspace/explorer-details-view.md
// "Preloaded"). The thumbnails' own rule: 200px ahead, once per row, cancelled on unmount. Null
// asks for nothing (an empty design, one in this browser, no viewer yet).
export function useSnapshotPrefetch(
  ref: RefObject<Element | null>,
  request: ThumbnailRequest | null,
): void {
  const ownerId = request?.ownerId;
  const designId = request?.designId;
  const version = request?.version;
  const shareCode = request?.shareCode ?? null;
  useEffect(() => {
    const el = ref.current;
    if (!el || ownerId === undefined || designId === undefined || version === undefined) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        // A failed fetch settles as `broken` in the cache; the preview then shows the undrawn sketch.
        loadThumbnail({ ownerId, designId, version, shareCode }).catch(() => {});
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, ownerId, designId, version, shareCode]);
}
