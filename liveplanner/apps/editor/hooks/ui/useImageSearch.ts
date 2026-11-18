'use client';

// Image Search for a form's pictures (docs/specs/030-forms/forms.md "Cover"): the workbench's search hook, bound once to
// this editor's telemetry and to a store that uploads a pick for the plan the picker is open on, as an upload from
// the device is (apiUploadImage), so the plan serves it. The picker names that plan (setImageSearchScope) before it
// searches: the workbench's hook carries only the owner and the plan's id, not the share link an Editor may be on.
import { createImageSearch } from '@liveworkspace/workbench/hooks/ui/useImageSearch';
import type { ImportImageFailure } from '@liveworkspace/workbench/lib/import-images/types';
import { track } from '@/lib/telemetry';
import { ImageUploadError, apiUploadImage, type ImagesScope } from '@/lib/api/images';

let scope: ImagesScope | null = null;

/** The plan (and link) a search's picks are stored for; null once the picker closes. */
export function setImageSearchScope(next: ImagesScope | null): void {
  scope = next;
}

const FAILURES: Partial<Record<ImageUploadError['code'], ImportImageFailure>> = {
  unsupported_type: 'unsupported',
  unreadable: 'unsupported',
  file_too_large: 'too-large',
  empty_file: 'missing-bytes',
  gallery_full: 'gallery-full',
  images_unavailable: 'images-unavailable',
};

export const useImageSearch = createImageSearch({
  track,
  openImportSession: async () => ({
    store: async (source) => {
      if (!scope) return { ok: false, failure: 'images-unavailable' };
      const blob =
        source.kind === 'blob' ? source.blob : await (await fetch(source.dataUrl)).blob();
      const file = new File([blob], source.name ?? 'image', { type: blob.type });
      try {
        const { image, deduped } = await apiUploadImage(scope, file);
        return {
          ok: true,
          imageId: image.id,
          width: image.width,
          height: image.height,
          kind: deduped ? 'deduped' : 'uploaded',
        };
      } catch (e) {
        const code = e instanceof ImageUploadError ? e.code : 'upload_failed';
        return { ok: false, failure: FAILURES[code] ?? 'upload-failed' };
      }
    },
  }),
});
