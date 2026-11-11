'use client';

import { memo, useMemo, useState } from 'react';
import {
  containedPictureRect,
  imageBackingStyle,
  imageCornerPx,
  type ImageElement,
} from '@livedesign/design';
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
import { Glyph } from '@livedesign/ui';

// Renders the bitmap (or upload placeholder) for an ImageElement.
// Mounted inside BoxedElementView's transformed wrapper so it picks
// up the element's pan + zoom for free; this component only worries
// about loading the bytes + showing the empty / broken states.
//
// Auth: `<img src>` can't send an Authorization header, so
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
  // Owner identifying the requester. Either the design owner (when
  // viewing one of their own designs) or a share-link visitor; the
  // api-client picks the account's or the guest's token internally.
  ownerId: string;
  // Design the element lives on; required for share-code reads so
  // the API can verify the design references this image.
  designId: string;
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
  designId,
  shareCode,
  onOpenPicker,
  fontFamily,
}: ImageElementViewProps) {
  const { imageId } = element;
  const state = useImageBlobUrl(ownerId, imageId, { designId, shareCode });
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
  // The picture's own size: the element's, else the bitmap's once it loads (for a contained picture's bands).
  const [loadedSize, setLoadedSize] = useState<{ width: number; height: number } | null>(null);
  const natural =
    element.naturalWidth && element.naturalHeight
      ? { width: element.naturalWidth, height: element.naturalHeight }
      : loadedSize;
  const noteSize = (img: HTMLImageElement) => {
    if (natural || !img.naturalWidth || !img.naturalHeight) return;
    setLoadedSize({ width: img.naturalWidth, height: img.naturalHeight });
  };
  // Where the picture is drawn in the box (a contained one's own rectangle, else the whole box): the white runs to
  // the box's edge only where the picture leaves it bare (imageBackingStyle).
  const pictureRect =
    fit === 'contain' && natural
      ? containedPictureRect(element.width, element.height, natural.width, natural.height)
      : null;
  const { width: boxW, height: boxH } = element;
  const [pictureX, pictureY, pictureW, pictureH] = pictureRect
    ? [pictureRect.x, pictureRect.y, pictureRect.width, pictureRect.height]
    : [0, 0, boxW, boxH];
  const backingStyle = useMemo(
    () =>
      imageBackingStyle(boxW, boxH, {
        x: pictureX,
        y: pictureY,
        width: pictureW,
        height: pictureH,
      }),
    [boxW, boxH, pictureX, pictureY, pictureW, pictureH],
  );

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
    // Where the picture reaches the box's edge the white stops short of it (docs/specs/009-elements/images.md
    // "The white under a picture"): drawn to the same edge, both were anti-aliased there, and at a fractional zoom
    // the edge pixels blended the picture over part-white ones, a light hairline round a picture on a dark
    // background. The padding only insets the background; the picture is laid over the whole box.
    //
    // A Media animation (docs/specs/028-animation/element-animations.md) sits on this frame, so the
    // picture moves inside its crop and never past it.
    <div
      className={`relative h-full w-full overflow-hidden rounded ${bodySetClass(element, 'media') ?? ''}`}
      style={{ ...radiusStyle, ...backingStyle.frame }}
    >
      {backingStyle.bands ? (
        // The white in the bands the picture leaves bare, on a layer with square corners: on the rounded frame the
        // shadows' inner edge would follow the radius and leave a white fillet where a band meets the picture.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={backingStyle.bands}
        />
      ) : null}
      <img
        src={state.src}
        alt={element.alt ?? ''}
        // Decoded off the main thread, so a picture coming into view never stalls a pan.
        decoding="async"
        onError={() => setUndecodable(state.src)}
        // A picture with no stored size learns it here, so a contained one's bands are known (once per load).
        onLoad={(e) => noteSize(e.currentTarget)}
        draggable={false}
        className="absolute inset-0 block h-full w-full select-none"
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
