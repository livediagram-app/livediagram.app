'use client';

import { memo, useMemo, useState } from 'react';
import { imageCornerPx, type ImageElement } from '@livedocuments/document';
import { useElementFinish } from '@/components/canvas/CanvasFinishContext';
import { useCanvasTheme, useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
import { ImageEmptyFace } from '@/components/canvas/ImageEmptyFace';
import {
  IMAGE_BROKEN_TONE,
  IMAGE_SKELETON_BODY,
  imagePlaceholderMetrics,
  imagePlaceholderTone,
  placeholderThemeInk,
} from '@/components/canvas/image-placeholder-look';
import { useImageBlobUrl } from '@/hooks/persistence/useImageBlobUrl';
import { bodySetClass } from '@/lib/animation-classes';
import { Glyph } from '@livedocuments/ui';

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
  // Owner identifying the requester. Either the document owner (when
  // viewing one of their own documents) or a share-link visitor; the
  // api-client picks Authorization vs X-Owner-Id internally.
  ownerId: string;
  // Document the element lives on; required for share-code reads so
  // the API can verify the document references this image.
  documentId: string;
  // Share code carried by the visitor, when any. Null for the owner
  // session. Drives the X-Share-Code header on the fetch.
  shareCode: string | null;
  // Opens the image picker for an element: present when this session
  // may pick (owner / edit-role visitor), absent for view-role visitors.
  // Drives the empty placeholder's Select Image button; the double-click
  // that opens it too lives in BoxedElementView. useEditorImages keeps
  // it reference-stable, so the memo's shallow equality still holds.
  onOpenPicker?: (elementId: string) => void;
  // The element's resolved font stack (its own, else the tab's theme font): the placeholder's
  // words are set in it, as its page's text is. Undefined falls back to the app's sans.
  fontFamily?: string;
};

function ImageElementViewImpl({
  element,
  ownerId,
  documentId,
  shareCode,
  onOpenPicker,
  fontFamily,
}: ImageElementViewProps) {
  const { imageId } = element;
  const state = useImageBlobUrl(ownerId, imageId, { documentId, shareCode });
  // A picture whose bytes arrived but will not decode (a truncated data: URL, a corrupt upload) is unavailable too:
  // left to the browser it drew its own broken-image glyph on a white box. Keyed to the source, so a new one retries.
  const [undecodable, setUndecodable] = useState<string | null>(null);
  const src = state.status === 'ready' ? state.src : null;

  // Corner radius follows the element's borderRadius so a circular avatar
  // ('full' → clamped to 50%) and a rounded hero ('lg') clip correctly;
  // defaults to the old 4px `rounded` look. Applied inline (overriding the
  // base `rounded` class) on every state so the placeholder + skeleton match
  // the final shape. `objectFit` defaults to 'contain' (whole image shows);
  // the hero + avatar set 'cover' so a photo fills the box / circle.
  // Never more than a quarter of the shorter side (docs/specs/008-canvas/corner-radius.md).
  // Square by default under Professional (docs/specs/008-canvas/finish.md "Images").
  const radius = imageCornerPx(element, useElementFinish(undefined));
  const radiusStyle = { borderRadius: radius };
  const fit = element.objectFit ?? 'contain';

  // The paper under the element (its page's fill, else the canvas), never the app's chrome: a
  // light page in dark chrome keeps dark ink (docs/specs/009-elements/images.md "Placeholder rendering").
  const surface = useElementSurface(element.id);
  // Dressed in the tab's theme where it has colours of its own, kept legible on this paper.
  const theme = useCanvasTheme();
  const tone = useMemo(
    () => imagePlaceholderTone(surface, theme ? placeholderThemeInk(theme) : null),
    [surface, theme],
  );

  if (!imageId) {
    // Empty: the app's empty state on the canvas, with a Select Image button. Double-clicking the
    // box opens the picker too (BoxedElementView), and a single click still selects, so the
    // placeholder can be moved and resized. Someone who cannot pick sees the face with no button.
    return (
      <ImageEmptyFace
        elementId={element.id}
        width={element.width}
        height={element.height}
        round={element.borderRadius === 'full'}
        tone={tone}
        surface={surface}
        radius={radius}
        fontFamily={fontFamily}
        onOpenPicker={onOpenPicker}
      />
    );
  }

  if (state.status === 'broken' || (src !== null && undecodable === src)) {
    const tone = IMAGE_BROKEN_TONE[surface];
    const metrics = imagePlaceholderMetrics(element.width, element.height);
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded border px-2 text-center font-sans"
        style={{
          ...radiusStyle,
          gap: metrics.gapPx,
          background: tone.body,
          borderColor: tone.border,
          color: tone.ink,
        }}
        role={metrics.showLabel ? undefined : 'img'}
        aria-label={metrics.showLabel ? undefined : 'Image unavailable'}
      >
        <BrokenIcon size={metrics.iconPx} />
        {metrics.showLabel ? (
          <span
            className="font-medium not-italic leading-tight"
            style={{ fontSize: metrics.labelPx }}
          >
            Image unavailable
          </span>
        ) : null}
      </div>
    );
  }

  if (state.status !== 'ready') {
    // Loading skeleton: keep the empty box from flashing as "no
    // image" while the bytes are in flight.
    return (
      <div
        className="h-full w-full animate-pulse rounded"
        style={{ ...radiusStyle, background: IMAGE_SKELETON_BODY[surface] }}
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
    //
    // A Media animation (docs/specs/028-animation/element-animations.md) sits on this frame, so the
    // picture moves inside its crop and never past it.
    <div
      className={`h-full w-full overflow-hidden rounded bg-white ${bodySetClass(element, 'media') ?? ''}`}
      style={radiusStyle}
    >
      <img
        src={state.src}
        alt={element.alt ?? ''}
        // Decoded off the main thread, so a picture coming into view never stalls a pan.
        decoding="async"
        onError={() => setUndecodable(state.src)}
        draggable={false}
        className="block h-full w-full select-none"
        style={{ objectFit: fit }}
      />
    </div>
  );
}

export const ImageElementView = memo(ImageElementViewImpl);

function BrokenIcon({ size }: { size: number }) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 17l5-5 4 4 2-2" />
      <path d="M16 6l5 5" />
      <path d="M21 6l-5 5" />
    </Glyph>
  );
}
