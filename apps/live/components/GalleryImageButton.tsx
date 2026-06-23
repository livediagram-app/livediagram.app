'use client';

import type { ImageSummary } from '@livediagram/api-schema';
import { useImageBlobUrl } from '@/hooks/persistence/useImageBlobUrl';

// Aspect-square clickable thumbnail for one ImageSummary. Used by
// the ImagePicker's Gallery tab + the Current Tab Images
// accordion. Both surfaces want the same "loading skeleton →
// broken state → bitmap" render pipeline; this component is the
// single source of truth for it.
//
// Wrappers (e.g. a `<li>` row for the picker, a delete overlay
// only the picker uses) stay in the caller so this component
// owns the button + bitmap and nothing else. Same reasoning that
// drove useImageBlobUrl: the loading state machine isn't worth
// duplicating in three places, but the surrounding chrome is per-
// call-site.

type GalleryImageButtonProps = {
  image: ImageSummary;
  ownerId: string;
  diagramId: string;
  // Optional share code. The bytes endpoint accepts an X-Share-Code
  // header for visitors authorised via a share link; owners pass
  // null. Picker callers (owner-only) omit it entirely.
  shareCode?: string | null;
  onClick: () => void;
  ariaLabel: string;
};

export function GalleryImageButton({
  image,
  ownerId,
  diagramId,
  shareCode,
  onClick,
  ariaLabel,
}: GalleryImageButtonProps) {
  const state = useImageBlobUrl(ownerId, image.id, {
    diagramId,
    shareCode: shareCode ?? null,
  });
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="block aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-500/60"
    >
      {state.status === 'ready' ? (
        <img
          src={state.src}
          alt={image.originalName ?? ''}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : state.status === 'broken' ? (
        <span className="block h-full w-full bg-rose-50 dark:bg-rose-500/15" />
      ) : (
        <span className="block h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800" />
      )}
    </button>
  );
}
