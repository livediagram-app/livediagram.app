'use client';

import { useEffect, useRef, useState } from 'react';
import { Portal } from './Portal';
import { apiDeleteImage, apiListImages, type ImageSummary } from '@/lib/api-client';
import { ImageUploadError, uploadImageFile } from '@/lib/upload-image';
import { useConfirm } from '@/hooks/useConfirm';
import { useEscape } from '@/hooks/useEscape';
import { TrashIcon } from './explorer-icons';
import { GalleryImageButton } from './GalleryImageButton';
import { ImageDropZone } from './ImageDropZone';

// Two-tab modal launched from the Image element's placeholder + the
// "Upload image" palette button. Tab 1 (Upload) accepts a file via
// drag-drop or file input, runs client-side validation (MIME + size +
// dimensions) and SHA-256 hashing for dedupe, then POSTs to
// /api/images. Tab 2 (Gallery) lists every image the owner has
// uploaded so they can reuse one without re-uploading. Spec/19.
//
// Upload validation + hashing + the apiUploadImage call live in
// lib/upload-image.ts so the Explorer Image Gallery can reuse the
// same flow (spec/15) without duplicating the rules.

type ImagePickerProps = {
  ownerId: string;
  diagramId: string;
  // When set, the picker is selecting an image for this specific
  // element id: the parent applies the chosen imageId + dimensions
  // to that element. When null, the picker is opening for a fresh
  // "Add image" gesture and onSelect is responsible for placing a
  // new ImageElement.
  forElementId: string | null;
  // The image currently attached to that element (if any). When
  // truthy AND onRemove is provided, the picker renders a footer
  // "Remove from element" action that detaches the image from
  // the element without touching the gallery copy.
  currentImageId?: string | null;
  onRemove?: () => void;
  onSelect: (image: ImageSummary) => void;
  onClose: () => void;
};

export function ImagePicker({
  ownerId,
  diagramId,
  forElementId: _forElementId,
  currentImageId,
  onRemove,
  onSelect,
  onClose,
}: ImagePickerProps) {
  const [tab, setTab] = useState<'upload' | 'gallery'>('upload');
  const [gallery, setGallery] = useState<ImageSummary[] | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    apiListImages(ownerId)
      .then((list) => {
        if (list === null) {
          setGalleryError('Image uploads are not enabled on this deployment.');
          setGallery([]);
          return;
        }
        setGallery(list);
      })
      .catch(() => setGalleryError('Could not load your gallery.'));
  }, [ownerId]);

  useEscape(onClose);

  // Clipboard paste support. While the picker is open, a paste
  // gesture (Cmd-V / Ctrl-V or right-click → Paste) lifts the
  // first image file off the clipboard and runs it through the
  // same handleFile path as drag-drop / file input. Pasting a
  // screenshot is the most common image source after drag-drop,
  // so handling it natively saves the user a "save to disk → drag
  // in" detour. Only attaches the listener while the picker is
  // mounted; the keydown handler above lives on the document so
  // the paste one does too (a focused button inside the dialog
  // doesn't bubble the paste event to the dialog otherwise).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          void handleFile(file);
          return;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // handleFile reads `ownerId` / `onSelect` from the enclosing
    // closure; both are stable for the picker's lifetime so the
    // empty dep array is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const { image } = await uploadImageFile(ownerId, file);
      onSelect(image);
    } catch (e) {
      setUploadError(e instanceof ImageUploadError ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (image: ImageSummary) => {
    const ok = await confirm({
      title: `Delete "${image.originalName ?? 'image'}"?`,
      message:
        'This image will be permanently removed from your gallery. This can’t be undone, and any element still using it will show a broken-image placeholder.',
      confirmLabel: 'Delete image',
    });
    if (!ok) return;
    try {
      await apiDeleteImage(ownerId, image.id);
      setGallery((prev) => (prev ? prev.filter((i) => i.id !== image.id) : prev));
    } catch {
      setGalleryError('Delete failed.');
    }
  };

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Image picker"
          className="flex w-[640px] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Image</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </header>
          <nav className="flex gap-1 border-b border-slate-200 px-4 pt-3 dark:border-slate-800">
            <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
              Upload
            </TabButton>
            <TabButton active={tab === 'gallery'} onClick={() => setTab('gallery')}>
              Gallery {gallery ? `(${gallery.length})` : ''}
            </TabButton>
          </nav>
          <div className="p-4">
            {tab === 'upload' ? (
              <ImageDropZone
                onSelectFile={handleFile}
                uploading={uploading}
                error={uploadError}
                prompt="Drop, paste, or click to choose an image"
                heightClass="h-48"
                gapClass="gap-2"
              />
            ) : (
              <GalleryGrid
                ownerId={ownerId}
                diagramId={diagramId}
                gallery={gallery}
                error={galleryError}
                onSelect={onSelect}
                onDelete={handleDelete}
              />
            )}
          </div>
          {currentImageId && onRemove ? (
            <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Detaches the image from this element. The gallery copy is kept.
              </p>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-slate-700 dark:text-rose-300 dark:hover:bg-rose-500/15"
              >
                Remove from element
              </button>
            </footer>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

function GalleryGrid({
  ownerId,
  diagramId,
  gallery,
  error,
  onSelect,
  onDelete,
}: {
  ownerId: string;
  diagramId: string;
  gallery: ImageSummary[] | null;
  error: string | null;
  onSelect: (image: ImageSummary) => void;
  onDelete: (image: ImageSummary) => void;
}) {
  if (error) {
    return (
      <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
        {error}
      </p>
    );
  }
  if (!gallery) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  if (gallery.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
        No images yet. Drop one in the Upload tab and it'll show up here.
      </p>
    );
  }
  return (
    <ul className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
      {gallery.map((image) => (
        <GalleryTile
          key={image.id}
          ownerId={ownerId}
          diagramId={diagramId}
          image={image}
          onSelect={() => onSelect(image)}
          onDelete={() => onDelete(image)}
        />
      ))}
    </ul>
  );
}

function GalleryTile({
  ownerId,
  diagramId,
  image,
  onSelect,
  onDelete,
}: {
  ownerId: string;
  diagramId: string;
  image: ImageSummary;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group relative">
      <GalleryImageButton
        image={image}
        ownerId={ownerId}
        diagramId={diagramId}
        onClick={onSelect}
        ariaLabel={`Use ${image.originalName ?? 'image'}`}
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${image.originalName ?? 'image'}`}
        className="absolute right-1 top-1 hidden rounded bg-white/90 p-1 text-rose-700 shadow transition hover:bg-rose-50 group-hover:block dark:bg-slate-900/90 dark:text-rose-300 dark:hover:bg-rose-500/15"
      >
        <TrashIcon strokeWidth={1.6} />
      </button>
    </li>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-t-md border-b-2 border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-200'
          : 'rounded-t-md border-b-2 border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }
    >
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 3l10 10M3 13l10-10" />
    </svg>
  );
}
