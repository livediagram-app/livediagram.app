'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import {
  containedPictureRect,
  imageBackingStyle,
  imageCornerPx,
  imageDrawsCover,
  imageIsShaped,
  imageLayout,
  imageMaskPath,
  isImageMask,
  type ImageElement,
} from '@livedocuments/document';
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
import { ImageCropOverlay } from '@/components/canvas/ImageCropOverlay';
import { endImageCrop, useIsImageCropping } from '@/lib/image-crop-store';
import type { CropResult } from '@/lib/image-crop-math';

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
  // Cropping (docs/specs/009-elements/picture-crop-and-mask.md): whether the element is selected, and the commit a
  // finished crop lands through, present only for an Editor who may change this image.
  isSelected?: boolean;
  onCommitCrop?: (elementId: string, result: CropResult) => void;
};

function ImageElementViewImpl({
  element,
  ownerId,
  documentId,
  shareCode,
  onOpenPicker,
  fontFamily,
  isSelected = false,
  onCommitCrop,
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
  const cornerPx = imageCornerPx(element, useElementFinish(undefined));
  // A mask cuts the box to its shape (docs/specs/009-elements/picture-crop-and-mask.md): it replaces the corner
  // radius, and a masked picture always covers its shape. The path is the box's px, worked out per size.
  const mask = isImageMask(element.mask) ? element.mask : undefined;
  const maskPath = useMemo(
    () => (mask ? `path('${imageMaskPath(mask, element.width, element.height)}')` : undefined),
    [mask, element.width, element.height],
  );
  const radius = mask ? 0 : cornerPx;
  const radiusStyle = { borderRadius: radius };
  const fit = imageDrawsCover(element) ? 'cover' : 'contain';
  // The picture's own size, for laying out a crop: the element's, else the bitmap's once it loads.
  const [loadedSize, setLoadedSize] = useState<{ width: number; height: number } | null>(null);
  const natural =
    element.naturalWidth && element.naturalHeight
      ? { width: element.naturalWidth, height: element.naturalHeight }
      : loadedSize;
  // Cropping this image: only while it is selected, has a picture to crop and may be changed; anything else ends it.
  const cropping = useIsImageCropping(element.id);
  const canCrop = isSelected && !!onCommitCrop && !!imageId && !element.locked;
  useEffect(() => {
    if (cropping && !canCrop) endImageCrop();
  }, [cropping, canCrop]);
  useEffect(() => () => (cropping ? endImageCrop() : undefined), [cropping]);
  const shaped = imageIsShaped(element);
  const grey = element.greyscale === true ? 'grayscale(1)' : undefined;
  const noteSize = (img: HTMLImageElement) => {
    if (natural || !img.naturalWidth || !img.naturalHeight) return;
    setLoadedSize({ width: img.naturalWidth, height: img.naturalHeight });
  };
  const layout = shaped ? imageLayout(element, natural, element.crop, fit) : null;
  // Where the picture is drawn in the box: a crop's part, a contained picture's own rectangle, else the whole box.
  // The white runs to the box's edge only where the picture leaves it bare (imageBackingStyle).
  const pictureRect = layout
    ? layout.part
    : fit === 'contain' && natural
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
        round={element.borderRadius === 'full' || mask === 'circle'}
        tone={tone}
        surface={surface}
        radius={cornerPx}
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
          clipPath: maskPath,
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
        style={{ ...radiusStyle, clipPath: maskPath, background: IMAGE_SKELETON_BODY[surface] }}
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
    // the edge pixels blended the picture over part-white ones, a light hairline round a picture on a dark page.
    // The padding only insets the background; the picture is laid over the whole box.
    //
    // A Media animation (docs/specs/028-animation/element-animations.md) sits on this frame, so the
    // picture moves inside its crop and never past it.
    <div
      className={`relative h-full w-full overflow-hidden rounded ${bodySetClass(element, 'media') ?? ''}`}
      style={{ ...radiusStyle, ...backingStyle, clipPath: maskPath }}
    >
      {layout ? (
        // A crop or a mask: the kept part laid into the box and the picture placed around it (imageLayout). A
        // letterboxed crop keeps its own edges inside the part's box.
        <div
          className="absolute overflow-hidden"
          style={{
            left: layout.part.x,
            top: layout.part.y,
            width: layout.part.width,
            height: layout.part.height,
          }}
        >
          <img
            src={state.src}
            alt={element.alt ?? ''}
            decoding="async"
            onError={() => setUndecodable(state.src)}
            onLoad={(e) => noteSize(e.currentTarget)}
            draggable={false}
            className="absolute block max-w-none select-none"
            style={{
              left: layout.picture.x - layout.part.x,
              top: layout.picture.y - layout.part.y,
              width: layout.picture.width,
              height: layout.picture.height,
              filter: grey,
            }}
          />
        </div>
      ) : (
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
          style={{ objectFit: fit, filter: grey }}
        />
      )}
      {cropping && canCrop ? (
        <ImageCropOverlay
          element={element}
          src={state.src}
          natural={natural}
          onApply={(result) => onCommitCrop?.(element.id, result)}
        />
      ) : null}
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
