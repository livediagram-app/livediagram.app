'use client';

// Each photo page's picture for the Contents thumbnails (docs/specs/007-editor/pages-mode.md "Contents"): its
// preview's object URL (docs/specs/031-photo/photo-store.md "Previews"), from the cache the canvas's own preview
// layer fills (usePhotoPreviewUrl), so a picture is fetched once for both. Without one a photo page's thumbnail is
// the checkerboard and a picture glyph, as before its preview is made.
import { useEffect, useMemo, useState } from 'react';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { previewUrlFor } from './usePhotoPreviewUrl';

const NONE: ReadonlyMap<string, string> = new Map();

/** The preview URL of each of `pageIds` that is a photo page with a preview, by page id. */
export function usePhotoThumbHrefs(
  photo: PhotoEditorView | undefined,
  pageIds: readonly string[],
): ReadonlyMap<string, string> {
  const photos = photo?.photos;
  const key = pageIds.join(',');
  // [page id, preview id] for the drawn rows that show a photo with a preview.
  const wanted = useMemo(
    () =>
      photos
        ? pageIds.flatMap((id) => {
            const preview = photos[id]?.preview;
            return preview ? [[id, preview] as const] : [];
          })
        : [],
    // On the rows drawn, not the array's identity.
    // oxlint-disable-next-line react/exhaustive-deps
    [photos, key],
  );
  const [hrefs, setHrefs] = useState<ReadonlyMap<string, string>>(NONE);
  const scope = photo?.scope ?? null;
  const tabId = photo?.tabId ?? '';
  const store = photo?.store ?? null;
  useEffect(() => {
    if (!scope || wanted.length === 0) {
      setHrefs((was) => (was.size === 0 ? was : NONE));
      return;
    }
    let live = true;
    void Promise.all(
      wanted.map(([pageId, preview]) =>
        previewUrlFor(scope, tabId, preview, store?.ownBlob(preview)).then(
          (url) => [pageId, url] as const,
        ),
      ),
    ).then((all) => {
      if (!live) return;
      const next = new Map<string, string>();
      for (const [pageId, url] of all) if (url) next.set(pageId, url);
      // The same pictures keep the same map, so the thumbnails do not redraw for nothing.
      setHrefs((was) =>
        was.size === next.size && [...next].every(([k, v]) => was.get(k) === v) ? was : next,
      );
    });
    return () => {
      live = false;
    };
    // The scope's identity changes with each render; its values do not here.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [wanted, tabId, scope?.designId]);
  return hrefs;
}
