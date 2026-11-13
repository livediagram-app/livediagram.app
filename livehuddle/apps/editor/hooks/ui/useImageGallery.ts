'use client';

// The person's image gallery for a picker (@liveworkspace/workbench/hooks/ui/useImageGallery), through this editor's
// api client and offline store.
import { createImageGallery } from '@liveworkspace/workbench/hooks/ui/useImageGallery';
import { apiFetchImageDataUrl, apiListImages } from '@/lib/api-client';
import { isOfflineIdSync } from '@/lib/offline/offline-store';

export type { ImageGallery } from '@liveworkspace/workbench/hooks/ui/useImageGallery';

export const useImageGallery = createImageGallery({
  apiListImages: (ownerId) => apiListImages(ownerId),
  apiFetchImageDataUrl: (ownerId, imageId) => apiFetchImageDataUrl(ownerId, imageId),
  isOfflineIdSync: (id) => isOfflineIdSync(id),
});
