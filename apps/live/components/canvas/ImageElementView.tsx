'use client';

import { memo } from 'react';
import { BORDER_RADIUS_PX, type ImageElement } from '@livediagram/diagram';
import { useImageBlobUrl } from '@/hooks/persistence/useImageBlobUrl';

// Renders the bitmap (or upload placeholder) for an ImageElement.
// Mounted inside BoxedElementView's transformed wrapper so it picks
// up the element's pan + zoom for free; this component only worries
// about loading the bytes + showing the empty / broken states.
//
// Auth: `<img src>` can't send Authorization / X-Owner-Id headers, so
// the bytes flow through `apiFetchImageBlobUrl`, which fetches via
// the same authenticated client used everywhere else and hands back
// a blob URL. The URL is revoked on unmount + on `imageId` change so
// the browser doesn't leak the blob.
//
// Wrapped in React.memo at the export below. Every prop is a
// primitive or a reference-stable element object, so the shallow
// equality check skips re-renders when only an unrelated element
// or selection flag changed on the surrounding tab.
type ImageElementViewProps = {
  element: ImageElement;
  // Owner identifying the requester. Either the diagram owner (when
  // viewing one of their own diagrams) or a share-link visitor; the
  // api-client picks Authorization vs X-Owner-Id internally.
  ownerId: string;
  // Diagram the element lives on; required for share-code reads so
  // the API can verify the diagram references this image.
  diagramId: string;
  // Share code carried by the visitor, when any. Null for the owner
  // session. Drives the X-Share-Code header on the fetch.
  shareCode: string | null;
  // True when the editor exposes an image-picker affordance for this
  // session (signed-in editor / edit-role visitor). False for
  // view-role visitors. The actual double-click handler that opens
  // the picker lives in BoxedElementView; this flag only drives the
  // empty-state placeholder copy. A plain boolean (rather than a
  // pre-bound callback) keeps the memo's shallow equality cheap
  // and stable.
  canOpenPicker: boolean;
};

function ImageElementViewImpl({
  element,
  ownerId,
  diagramId,
  shareCode,
  canOpenPicker,
}: ImageElementViewProps) {
  const { imageId } = element;
  const state = useImageBlobUrl(ownerId, imageId, { diagramId, shareCode });

  // Corner radius follows the element's borderRadius so a circular avatar
  // ('full' → clamped to 50%) and a rounded hero ('lg') clip correctly;
  // defaults to the old 4px `rounded` look. Applied inline (overriding the
  // base `rounded` class) on every state so the placeholder + skeleton match
  // the final shape. `objectFit` defaults to 'contain' (whole image shows);
  // the hero + avatar set 'cover' so a photo fills the box / circle.
  const radius = element.borderRadius !== undefined ? BORDER_RADIUS_PX[element.borderRadius] : 4;
  const radiusStyle = { borderRadius: radius };
  const fit = element.objectFit ?? 'contain';

  if (!imageId) {
    // Empty placeholder. Double-click opens the picker for editors
    // so a single click (and the drag that follows it) can still
    // move / resize the placeholder without spawning the modal.
    // View-role visitors see the same hint with no picker.
    const placeholderBase =
      'flex h-full w-full flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white';
    if (!canOpenPicker) {
      return (
        <div className={placeholderBase} style={radiusStyle}>
          <ImageIcon />
          <span className="text-[10px] font-medium">No image</span>
        </div>
      );
    }
    return (
      <div
        className={`${placeholderBase} cursor-pointer transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200`}
        style={radiusStyle}
      >
        <ImageIcon />
        <span className="text-[10px] font-medium">Double-click to upload</span>
      </div>
    );
  }

  if (state.status === 'broken') {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-1 rounded border border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
        style={radiusStyle}
      >
        <BrokenIcon />
        <span className="text-[10px] font-medium">Image unavailable</span>
      </div>
    );
  }

  if (state.status !== 'ready') {
    // Loading skeleton: keep the empty box from flashing as "no
    // image" while the bytes are in flight.
    return (
      <div
        className="h-full w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800"
        style={radiusStyle}
      />
    );
  }

  return (
    // `overflow-hidden rounded` lives here (not on the BoxedElement
    // wrapper) so the parent can let lock / comment / note badges
    // overflow outside the box without being clipped, while the
    // bitmap still gets its rounded-corner clip.
    //
    // Always white background (no dark variant): transparent PNGs +
    // light-content screenshots assume a white page underneath. In
    // dark mode without this, the canvas background bleeds through
    // any transparent areas and inverts the apparent contrast of
    // anti-aliased edges. Image element content is independent of
    // editor theme by convention (matches GitHub / Notion).
    <div className="h-full w-full overflow-hidden rounded bg-white" style={radiusStyle}>
      <img
        src={state.src}
        alt={element.alt ?? ''}
        draggable={false}
        className="block h-full w-full select-none"
        style={{ objectFit: fit }}
      />
    </div>
  );
}

export const ImageElementView = memo(ImageElementViewImpl);

function ImageIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M3.5 17l5-5 4 4 3-3 5 5" />
    </svg>
  );
}

function BrokenIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 17l5-5 4 4 2-2" />
      <path d="M16 6l5 5" />
      <path d="M21 6l-5 5" />
    </svg>
  );
}
