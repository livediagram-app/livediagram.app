'use client';

// The person's image gallery for a picker (docs/specs/009-elements/images.md "Gallery"): the list, read once on
// opening, and the pick of one of its pictures for this design. Shared by the Image picker's Gallery tab and a
// page background's Choose From My Images, so both read and re-home pictures by one rule.
import { useCallback, useEffect, useState } from 'react';
import { apiFetchImageDataUrl, apiListImages, type ImageSummary } from '@/lib/api-client';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import type { PickedImage } from '@/lib/upload-image';

export type ImageGallery = {
  // Null while it loads.
  gallery: ImageSummary[] | null;
  setGallery: (update: (prev: ImageSummary[] | null) => ImageSummary[] | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  // The picture as this design takes it, or null when it could not be (the error says why).
  pick: (image: ImageSummary) => Promise<PickedImage | null>;
};

export function useImageGallery(ownerId: string, designId: string, enabled = true): ImageGallery {
  const [gallery, setGallery] = useState<ImageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    apiListImages(ownerId)
      .then((list) => {
        if (!live) return;
        if (list === null) {
          setError('Image uploads are not enabled on this deployment.');
          setGallery([]);
          return;
        }
        setGallery(list);
      })
      .catch(() => {
        if (live) setError('Could not load your gallery.');
      });
    return () => {
      live = false;
    };
  }, [ownerId, enabled]);

  // Gallery picks re-home for offline designs (docs/specs/006-design/offline-mode.md): a bare gallery id
  // inside an offline design would break once the server's 30-day unused-image cleanup reaps it (nothing
  // server-side references it), so the bytes are fetched and embedded as a data URI instead, exactly like Take
  // Offline does for existing references.
  const pick = useCallback(
    async (image: ImageSummary): Promise<PickedImage | null> => {
      if (!isOfflineIdSync(designId)) return image;
      const href = await apiFetchImageDataUrl(ownerId, image.id).catch(() => null);
      if (!href) {
        setError('Could not load that image for offline use. Check your connection.');
        return null;
      }
      return { ...image, id: href };
    },
    [ownerId, designId],
  );

  return { gallery, setGallery, error, setError, pick };
}
