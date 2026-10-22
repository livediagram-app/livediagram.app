'use client';

import { useEffect, type RefObject } from 'react';
import { loadThumbnail, type ThumbnailRequest } from '@/lib/thumbnail-cache';

// Asks for a project's snapshot as its row nears the viewport, so the Details view's preview
// paints at once from the page's snapshot cache (docs/specs/013-workspace/explorer-details-view.md
// "Preloaded"). The thumbnails' own rule: 200px ahead, once per row, cancelled on unmount. Null
// asks for nothing (an empty project, one in this browser, no viewer yet).
export function useSnapshotPrefetch(
  ref: RefObject<Element | null>,
  request: ThumbnailRequest | null,
): void {
  const ownerId = request?.ownerId;
  const projectId = request?.projectId;
  const version = request?.version;
  const shareCode = request?.shareCode ?? null;
  useEffect(() => {
    const el = ref.current;
    if (!el || ownerId === undefined || projectId === undefined || version === undefined) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        // A failed fetch settles as `broken` in the cache; the preview then shows the undrawn sketch.
        loadThumbnail({ ownerId, projectId, version, shareCode }).catch(() => {});
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, ownerId, projectId, version, shareCode]);
}
