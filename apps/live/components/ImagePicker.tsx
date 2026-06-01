'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiDeleteImage, apiListImages, apiUploadImage, type ImageSummary } from '@/lib/api-client';
import { useImageBlobUrl } from '@/hooks/useImageBlobUrl';

// Two-tab modal launched from the Image element's placeholder + the
// "Upload image" palette button. Tab 1 (Upload) accepts a file via
// drag-drop or file input, runs client-side validation (MIME + size +
// dimensions) and SHA-256 hashing for dedupe, then POSTs to
// /api/images. Tab 2 (Gallery) lists every image the owner has
// uploaded so they can reuse one without re-uploading. Spec/19.

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT_ATTR = ACCEPTED_TYPES.join(',');

type ImagePickerProps = {
  ownerId: string;
  diagramId: string;
  // When set, the picker is selecting an image for this specific
  // element id: the parent applies the chosen imageId + dimensions
  // to that element. When null, the picker is opening for a fresh
  // "Add image" gesture and onSelect is responsible for placing a
  // new ImageElement.
  forElementId: string | null;
  onSelect: (image: ImageSummary) => void;
  onClose: () => void;
};

export function ImagePicker({
  ownerId,
  diagramId,
  forElementId: _forElementId,
  onSelect,
  onClose,
}: ImagePickerProps) {
  const [tab, setTab] = useState<'upload' | 'gallery'>('upload');
  const [gallery, setGallery] = useState<ImageSummary[] | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
    if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
      setUploadError(
        `Unsupported file type. Use PNG, JPEG, WebP, or GIF (SVG is rejected for security).`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`Too large. Limit is ${MAX_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    if (file.size === 0) {
      setUploadError('Empty file.');
      return;
    }
    setUploading(true);
    try {
      const bytes = await file.arrayBuffer();
      // SHA-256 dedupe key: the server re-verifies this against the
      // body so a client can't poison the gallery with a fake hash.
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      // Decode dimensions via a transient <img>. Async because the
      // browser parses the bytes off the main thread.
      const dims = await readImageDimensions(file);
      if (!dims) {
        setUploadError('Could not read image dimensions.');
        return;
      }
      const { image, deduped } = await apiUploadImage(ownerId, {
        bytes,
        contentType: file.type,
        sha256: sha,
        width: dims.width,
        height: dims.height,
        originalName: file.name,
      });
      if (deduped) {
        // Keep the picker open with a note so users understand why
        // their upload "finished instantly"; auto-select on the
        // next tick so onSelect doesn't fight the state update.
        setUploadError(null);
      }
      onSelect(image);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleDelete = async (image: ImageSummary) => {
    if (!confirm(`Delete "${image.originalName ?? 'image'}" from your gallery?`)) return;
    try {
      await apiDeleteImage(ownerId, image.id);
      setGallery((prev) => (prev ? prev.filter((i) => i.id !== image.id) : prev));
    } catch {
      setGalleryError('Delete failed.');
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
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
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition ${
                  dropActive
                    ? 'border-brand-400 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
                    : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10'
                }`}
              >
                <UploadIcon />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {uploading ? 'Uploading…' : 'Drop, paste, or click to choose an image'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  PNG, JPEG, WebP, or GIF up to 10 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {uploadError ? (
                <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  {uploadError}
                </p>
              ) : null}
            </>
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
      </div>
    </div>,
    document.body,
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
  const state = useImageBlobUrl(ownerId, image.id, { diagramId });
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className="block aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-brand-500/60"
        aria-label={`Use ${image.originalName ?? 'image'}`}
      >
        {state.status === 'ready' ? (
          <img
            src={state.src}
            alt={image.originalName ?? ''}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="block h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800" />
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${image.originalName ?? 'image'}`}
        className="absolute right-1 top-1 hidden rounded bg-white/90 p-1 text-rose-700 shadow transition hover:bg-rose-50 group-hover:block dark:bg-slate-900/90 dark:text-rose-300 dark:hover:bg-rose-500/15"
      >
        <TrashIcon />
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

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function UploadIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-slate-500 dark:text-slate-400"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
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

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  );
}
