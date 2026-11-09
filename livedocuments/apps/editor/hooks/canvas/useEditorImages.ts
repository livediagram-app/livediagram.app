// Image domain for the editor (docs/specs/009-elements/images.md), lifted out of
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
// history exactly like the rest of element
// CRUD; this hook only relocates the code, it doesn't change that
// contract.

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { cleanImageAlt, createImage, isBoxed, type Element } from '@livedocuments/document';
import { apiFetchImageDataUrl, apiListImages, type ImageSummary } from '@/lib/api-client';
import type { CropResult } from '@/lib/image-crop-math';
import { isDataImageId } from '@/lib/offline/offline-images';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import type { PickedImage } from '@/lib/upload-image';

type ImageDescriptor = PickedImage;

type EditorImagesDeps = {
  // Whether edits are currently disallowed (read-only role, or a
  // locked tab). Mirrors the page's `editsBlocked`; the placement
  // handlers no-op when set.
  editsBlocked: boolean;
  // What a picture swap alone answers to (docs/specs/009-elements/images.md "Locked images"): the
  // session's guard without the tab's lock, so a locked tab's images still take Select Image. Left
  // out, editsBlocked.
  pictureBlocked?: boolean;
  // Whether the current viewer is a view-only visitor. Gates the
  // recent-images fetch + the onOpenPicker handle on imageContext.
  isReadOnly: boolean;
  // Read-only embed chrome is gone (docs/specs/013-workspace/embeds.md: edit-role embeds are editable),
  // but IMAGE UPLOADS stay off in embeds: the upload endpoint authorises by
  // owner identity, and inside a partitioned third-party iframe that is a
  // throwaway per-partition guest — uploads would land in an un-owned
  // gallery nobody can manage. Everything else in the embed stays editable.
  embedMode: boolean;
  // The editor in a workbench uploads but never reads the person's gallery
  // (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table): no recent-images fetch.
  galleryHidden?: boolean;
  // Viewport centre in canvas coordinates — where freshly placed
  // images land.
  getViewportCenter: () => { x: number; y: number };
  // The active tab's elements as they are now, to tell whether a write changes anything before it commits.
  elements: () => readonly Element[];
  // The history-aware element mutator. Snapshots history, same path the
  // rest of element CRUD uses.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The commit a picture swap lands through: `commit` without the tab lock's refusal. Left out, commit.
  commitPicture?: (mapElements: (els: Element[]) => Element[]) => void;
  // Selects an element by id (or clears with null). Newly placed
  // images select themselves so the user can immediately resize.
  setSelectedId: (id: string | null) => void;
  // The current document id (null before hydration). The picker +
  // recent-images list only operate once it's known.
  documentId: string | null;
  // The local participant id — the owner the images belong to.
  ownerId: string;
  // The session's share code (edit-link visitors), forwarded to the
  // picker so uploads authorise correctly. Null = owner.
  sessionShareCode: string | null;
};

export function useEditorImages(deps: EditorImagesDeps) {
  const { editsBlocked, isReadOnly, embedMode, getViewportCenter, commit, setSelectedId } = deps;
  const pictureBlocked = deps.pictureBlocked ?? editsBlocked;
  const commitPicture = deps.commitPicture ?? commit;
  const elementsNow = deps.elements;
  const { documentId, ownerId, sessionShareCode, galleryHidden = false } = deps;

  const [imagePickerOpenFor, setImagePickerOpenFor] = useState<{
    forElementId: string | null;
  } | null>(null);
  const [recentImages, setRecentImages] = useState<ImageSummary[]>([]);

  const refreshRecentImages = useCallback((owner: string) => {
    apiListImages(owner)
      .then((list) => setRecentImages(list ?? []))
      .catch(() => setRecentImages([]));
  }, []);

  // Loads once on documentId mount; refreshed manually by
  // refreshRecentImages after a successful picker upload so a
  // newly-uploaded image surfaces without a document reload. View-
  // role visitors skip the fetch (the accordion is hidden for them
  // anyway via the !isReadOnly gate at the call site).
  // The owner is a trigger too: a document in This Browser opens under the 'self' placeholder and learns
  // who is reading afterwards (docs/specs/006-document/offline-mode.md "Instant open"), and the
  // placeholder is nobody's gallery.
  const loadRecentImages = useEffectEvent(() => refreshRecentImages(ownerId));
  useEffect(() => {
    if (!documentId || isReadOnly || embedMode || galleryHidden || ownerId === 'self') return;
    loadRecentImages();
  }, [documentId, isReadOnly, embedMode, galleryHidden, ownerId]);

  // Placing a NEW image lives in useElementCreation.addImage: it arms the
  // tap-or-drag draw gesture (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/images.md) rather than dropping a
  // placeholder at the viewport centre, and arming needs `beginDraw` from
  // useShapeDrawing, which runs after this hook. The old centre-drop
  // deliberately kept the picker shut so the user could position and resize
  // the empty box first; the draw gesture does that up front, so the commit
  // path opens the picker straight away (see useShapeDrawing.commitDraw).
  // Everything else about images — the picker, the gallery, fill / clear —
  // stays here.

  // Open the picker for an existing image element (the user clicked
  // its empty placeholder or "Change image" in the context menu).
  // useCallback so the function identity stays stable across
  // renders: the imageContext object below references it, and
  // BoxedElementView is memoised on imageContext identity (a fresh
  // arrow per render would invalidate the memo for every image
  // element on the active tab).
  const openImagePickerFor = useCallback(
    (elementId: string) => {
      if (pictureBlocked || embedMode) return;
      setImagePickerOpenFor({ forElementId: elementId });
    },
    [pictureBlocked, embedMode],
  );

  const closeImagePicker = useCallback(() => setImagePickerOpenFor(null), []);

  // Done on a crop (docs/specs/009-elements/picture-crop-and-mask.md): the box moves to the frame and keeps the part
  // of the picture under it, one undo step. A locked image keeps its place, so it is never cropped.
  const commitImageCrop = useCallback(
    (elementId: string, result: CropResult) => {
      commit((els) =>
        els.map((el) => {
          if (el.id !== elementId || el.type !== 'image' || el.locked) return el;
          const { crop: _old, ...rest } = el;
          void _old;
          return {
            ...rest,
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
            ...(result.crop ? { crop: result.crop } : {}),
          };
        }),
      );
    },
    [commit],
  );

  // Memoised so BoxedElementView's React.memo (commit e8e34f9)
  // doesn't see a fresh object identity every editor-page render.
  // Without this the parent passed a new object literal each time,
  // invalidating the memo for every image element on the active
  // tab whenever any unrelated state moved.
  const imageContext = useMemo(
    () =>
      documentId
        ? {
            ownerId,
            documentId,
            shareCode: sessionShareCode,
            // Offered only where the picker opens. A lock (the image's own or its tab's) holds its
            // place, not its picture, so a locked image keeps its Select Image button.
            onOpenPicker:
              isReadOnly || embedMode || pictureBlocked ? undefined : openImagePickerFor,
            // A crop moves and resizes the box (picture-crop-and-mask.md "Share roles"): an Editor's, outside a
            // locked tab.
            onCommitImageCrop: isReadOnly || editsBlocked ? undefined : commitImageCrop,
          }
        : undefined,
    [
      documentId,
      ownerId,
      sessionShareCode,
      isReadOnly,
      editsBlocked,
      embedMode,
      pictureBlocked,
      openImagePickerFor,
      commitImageCrop,
    ],
  );

  // Apply the picker's selection: set imageId + natural dimensions on
  // the target element. When the picker was opened with a fresh
  // forElementId (from addImage), the placeholder created by
  // addImage is the target. The element's width/height stay as the
  // user originally placed them; naturalWidth/Height drive the
  // aspect-lock default + the "Reset to natural size" context-menu
  // action.
  // A search pick carries a credit (docs/specs/009-elements/image-search.md); any
  // other pick drops the old one so it never describes a picture that's gone.
  const applyImageToElement = (elementId: string, image: ImageDescriptor) => {
    commitPicture((els) =>
      els.map((el) => {
        if (el.id !== elementId || !isBoxed(el) || el.type !== 'image') return el;
        const { credit: _old, ...rest } = el;
        void _old;
        return {
          ...rest,
          imageId: image.id,
          naturalWidth: image.width,
          naturalHeight: image.height,
          alt: el.alt ?? image.originalName,
          ...(image.credit ? { credit: image.credit } : {}),
        };
      }),
    );
    if (image.credit) track('Element', 'Used', 'ImageSearch');
    setImagePickerOpenFor(null);
  };

  // Detach the bitmap from an image element without touching the
  // gallery: imageId returns to null (placeholder rendering), and
  // the natural-size fields drop so a later "Reset to natural size"
  // doesn't snap to stale dimensions. The element's width/height
  // stay so the user keeps the footprint they sized to.
  const removeImageFromElement = (elementId: string) => {
    commitPicture((els) =>
      els.map((el) => {
        if (el.id !== elementId || !isBoxed(el) || el.type !== 'image') return el;
        const { naturalWidth: _w, naturalHeight: _h, credit: _c, ...rest } = el;
        void _w;
        void _h;
        void _c;
        return { ...rest, imageId: null };
      }),
    );
    setImagePickerOpenFor(null);
  };

  // Write an image's alt text (docs/specs/009-elements/images.md "Alt text"), cleaned as every path stores it: one
  // undo step, none when the cleaned words are what it holds, and words that clean to nothing remove it. Not gated on
  // editsBlocked: a Participant may write it (PARTICIPANT_TEXT_FIELDS), and the field only shows where `can` allows.
  const setImageAlt = (elementId: string, typed: string) => {
    const el = elementsNow().find((e) => e.id === elementId);
    if (!el || el.type !== 'image') return;
    const next = cleanImageAlt(typed);
    if (next === (el.alt ?? '')) return;
    commit((els) =>
      els.map((e) => {
        if (e.id !== elementId || e.type !== 'image') return e;
        const { alt: _old, ...rest } = e;
        void _old;
        return next ? { ...rest, alt: next } : rest;
      }),
    );
  };

  // Drop a new image element pre-filled with an existing gallery
  // image (skips the picker entirely). Fired from the Current Tab
  // "Images" accordion thumbnails. Sizes the placeholder to the
  // image's natural aspect ratio, capped at 240 px on the larger
  // side so it lands at a sensible canvas footprint regardless of
  // the original resolution. `at` centres it on a canvas point (a dropped file lands where it was released); the
  // viewport's centre otherwise.
  const addImageFromGallery = (image: ImageDescriptor, at?: { x: number; y: number }) => {
    // embedMode also blocks the clipboard's paste-image upload, which
    // funnels through this handler after uploading.
    if (editsBlocked || embedMode) return;
    // Offline documents must stay self-contained (docs/specs/006-document/offline-mode.md): a bare gallery
    // id would break once the server's unused-image cleanup reaps it, so
    // fetch the bytes and place a data-URI embed instead. Re-entry with
    // the data URI as the id lands in the placement branch below.
    if (documentId && isOfflineIdSync(documentId) && !isDataImageId(image.id)) {
      void apiFetchImageDataUrl(ownerId, image.id)
        .catch(() => null)
        .then((href) => {
          if (href) addImageFromGallery({ ...image, id: href }, at);
        });
      return;
    }
    const centre = at ?? getViewportCenter();
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
    addImageFromGallery,
    openImagePickerFor,
    applyImageToElement,
    removeImageFromElement,
    setImageAlt,
    refreshRecentImages,
    closeImagePicker,
  };
}
