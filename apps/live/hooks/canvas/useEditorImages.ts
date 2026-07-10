// Image domain for the editor (spec/19), lifted out of
// editor-page.tsx. Everything about placing, filling, clearing and
// listing image elements lives here so the page no longer carries
// the picker state, the recent-images list, or the six handlers
// that mutate them.
//
// What this hook owns:
//
// - `imagePickerOpenFor`: `null` = picker closed; an object = open
//   for that element id (existing placeholder being filled) OR
//   `forElementId: null` when the "Add image" gesture is fresh and
//   the picker will place a new element on commit. Drives the
//   <ImagePicker> JSX gate in the page.
// - `recentImages`: the owner's recent uploads for the Current Tab
//   "Images" accordion. Empty when R2 is unbound (apiListImages
//   returns null) or the owner has no uploads yet. Loaded on mount
//   and refreshed after a successful picker upload.
// - `imageContext`: memoised so BoxedElementView's React.memo
//   (commit e8e34f9) doesn't see a fresh object identity every
//   editor-page render. Without the memo the parent passed a new
//   object literal each render, invalidating the memo for every
//   image element on the active tab whenever any unrelated state
//   moved.
//
// All mutations route through the page's `commit` so they snapshot
// history + emit the activity log exactly like the rest of element
// CRUD; this hook only relocates the code, it doesn't change that
// contract.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createImage, isBoxed, type Element } from '@livediagram/diagram';
import { apiListImages, type ImageSummary } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

type ImageDescriptor = {
  id: string;
  width: number;
  height: number;
  originalName?: string;
};

type EditorImagesDeps = {
  // Whether edits are currently disallowed (read-only role, or a
  // locked tab). Mirrors the page's `editsBlocked`; the placement
  // handlers no-op when set.
  editsBlocked: boolean;
  // Whether the current viewer is a view-only visitor. Gates the
  // recent-images fetch + the onOpenPicker handle on imageContext.
  isReadOnly: boolean;
  // Read-only embed chrome is gone (spec/33: edit-role embeds are editable),
  // but IMAGE UPLOADS stay off in embeds: the upload endpoint authorises by
  // owner identity, and inside a partitioned third-party iframe that is a
  // throwaway per-partition guest — uploads would land in an un-owned
  // gallery nobody can manage. Everything else in the embed stays editable.
  embedMode: boolean;
  // Viewport centre in canvas coordinates — where freshly placed
  // images land.
  getViewportCenter: () => { x: number; y: number };
  // The history-aware element mutator. Snapshots history + emits the
  // activity log, same path the rest of element CRUD uses.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Selects an element by id (or clears with null). Newly placed
  // images select themselves so the user can immediately resize.
  setSelectedId: (id: string | null) => void;
  // The current diagram id (null before hydration). The picker +
  // recent-images list only operate once it's known.
  diagramId: string | null;
  // The local participant id — the owner the images belong to.
  ownerId: string;
  // The session's share code (edit-link visitors), forwarded to the
  // picker so uploads authorise correctly. Null = owner.
  sessionShareCode: string | null;
};

export function useEditorImages(deps: EditorImagesDeps) {
  const { editsBlocked, isReadOnly, embedMode, getViewportCenter, commit, setSelectedId } = deps;
  const { diagramId, ownerId, sessionShareCode } = deps;

  const [imagePickerOpenFor, setImagePickerOpenFor] = useState<{
    forElementId: string | null;
  } | null>(null);
  const [recentImages, setRecentImages] = useState<ImageSummary[]>([]);

  const refreshRecentImages = useCallback((owner: string) => {
    apiListImages(owner)
      .then((list) => setRecentImages(list ?? []))
      .catch(() => setRecentImages([]));
  }, []);

  // Loads once on diagramId mount; refreshed manually by
  // refreshRecentImages after a successful picker upload so a
  // newly-uploaded image surfaces without a diagram reload. View-
  // role visitors skip the fetch (the accordion is hidden for them
  // anyway via the !isReadOnly gate at the call site).
  useEffect(() => {
    if (!diagramId || isReadOnly || embedMode) return;
    refreshRecentImages(ownerId);
    // ownerId is stable for the session (set on mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId, isReadOnly, embedMode]);

  // Drop an empty image placeholder at the viewport centre. The
  // picker only opens via double-click on the placeholder (or
  // "Change image" in the context menu), so the user can position
  // and resize the empty box without the modal popping up first.
  const addImage = () => {
    if (editsBlocked || embedMode) return;
    const centre = getViewportCenter();
    const placeholder = createImage(centre.x - 100, centre.y - 75);
    commit((els) => [...els, placeholder]);
    setSelectedId(placeholder.id);
    track('Element', 'Added', 'Image');
  };

  // Open the picker for an existing image element (the user clicked
  // its empty placeholder or "Change image" in the context menu).
  // useCallback so the function identity stays stable across
  // renders: the imageContext object below references it, and
  // BoxedElementView is memoised on imageContext identity (a fresh
  // arrow per render would invalidate the memo for every image
  // element on the active tab).
  const openImagePickerFor = useCallback(
    (elementId: string) => {
      if (editsBlocked || embedMode) return;
      setImagePickerOpenFor({ forElementId: elementId });
    },
    [editsBlocked, embedMode],
  );

  const closeImagePicker = useCallback(() => setImagePickerOpenFor(null), []);

  // Memoised so BoxedElementView's React.memo (commit e8e34f9)
  // doesn't see a fresh object identity every editor-page render.
  // Without this the parent passed a new object literal each time,
  // invalidating the memo for every image element on the active
  // tab whenever any unrelated state moved.
  const imageContext = useMemo(
    () =>
      diagramId
        ? {
            ownerId,
            diagramId,
            shareCode: sessionShareCode,
            onOpenPicker: isReadOnly || embedMode ? undefined : openImagePickerFor,
          }
        : undefined,
    [diagramId, ownerId, sessionShareCode, isReadOnly, embedMode, openImagePickerFor],
  );

  // Apply the picker's selection: set imageId + natural dimensions on
  // the target element. When the picker was opened with a fresh
  // forElementId (from addImage), the placeholder created by
  // addImage is the target. The element's width/height stay as the
  // user originally placed them; naturalWidth/Height drive the
  // aspect-lock default + the "Reset to natural size" context-menu
  // action.
  const applyImageToElement = (elementId: string, image: ImageDescriptor) => {
    commit((els) =>
      els.map((el) =>
        el.id === elementId && isBoxed(el) && el.type === 'image'
          ? {
              ...el,
              imageId: image.id,
              naturalWidth: image.width,
              naturalHeight: image.height,
              alt: el.alt ?? image.originalName,
            }
          : el,
      ),
    );
    setImagePickerOpenFor(null);
  };

  // Detach the bitmap from an image element without touching the
  // gallery: imageId returns to null (placeholder rendering), and
  // the natural-size fields drop so a later "Reset to natural size"
  // doesn't snap to stale dimensions. The element's width/height
  // stay so the user keeps the footprint they sized to.
  const removeImageFromElement = (elementId: string) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || !isBoxed(el) || el.type !== 'image') return el;
        const { naturalWidth: _w, naturalHeight: _h, ...rest } = el;
        void _w;
        void _h;
        return { ...rest, imageId: null };
      }),
    );
    setImagePickerOpenFor(null);
  };

  // Drop a new image element pre-filled with an existing gallery
  // image (skips the picker entirely). Fired from the Current Tab
  // "Images" accordion thumbnails. Sizes the placeholder to the
  // image's natural aspect ratio, capped at 240 px on the larger
  // side so it lands at a sensible canvas footprint regardless of
  // the original resolution.
  const addImageFromGallery = (image: ImageDescriptor) => {
    // embedMode also blocks the clipboard's paste-image upload, which
    // funnels through this handler after uploading.
    if (editsBlocked || embedMode) return;
    const centre = getViewportCenter();
    const max = 240;
    const ratio = image.width / image.height;
    const w = image.width >= image.height ? max : Math.round(max * ratio);
    const h = image.height >= image.width ? max : Math.round(max / ratio);
    const placed = {
      ...createImage(centre.x - w / 2, centre.y - h / 2),
      width: w,
      height: h,
      imageId: image.id,
      naturalWidth: image.width,
      naturalHeight: image.height,
      alt: image.originalName,
    };
    commit((els) => [...els, placed]);
    setSelectedId(placed.id);
    track('Element', 'Added', 'Image');
  };

  return {
    imagePickerOpenFor,
    recentImages,
    imageContext,
    addImage,
    addImageFromGallery,
    openImagePickerFor,
    applyImageToElement,
    removeImageFromElement,
    refreshRecentImages,
    closeImagePicker,
  };
}
