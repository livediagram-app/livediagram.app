'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiDeleteImage, apiImageUsage, apiListImages, type ImageSummary } from '@/lib/api-client';
import {
  UPLOAD_ACCEPT_ATTR,
  UPLOAD_MAX_BYTES,
  uploadImageFile,
  ImageUploadError,
} from '@/lib/upload-image';
import { useConfirm } from '@/hooks/useConfirm';
import { GalleryImageButton } from './GalleryImageButton';

// Image Gallery pane on the Explorer page (spec/15). Shows every
// image the signed-in user has uploaded, with an inline "Used in"
// badge derived from /api/images/usage so the user can spot
// orphaned bytes that are safe to delete.
//
// Upload uses the shared lib/upload-image.ts helper, the same
// path the editor's ImagePicker takes (validation, sha256 dedupe,
// dimension read), so there's exactly one set of rules to maintain.

type GalleryPaneProps = {
  ownerId: string;
};

type Usage = Record<string, { id: string; name: string }[]>;

export function GalleryPane({ ownerId }: GalleryPaneProps) {
  const [gallery, setGallery] = useState<ImageSummary[] | null>(null);
  const [usage, setUsage] = useState<Usage>({});
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const refresh = useMemo(
    () => async () => {
      try {
        const [list, used] = await Promise.all([apiListImages(ownerId), apiImageUsage(ownerId)]);
        if (list === null) {
          setGalleryError('Image uploads are not enabled on this deployment.');
          setGallery([]);
          setUsage({});
          return;
        }
        setGallery(list);
        setUsage(used);
        setGalleryError(null);
      } catch {
        setGalleryError('Could not load your gallery.');
      }
    },
    [ownerId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      await uploadImageFile(ownerId, file);
      await refresh();
    } catch (e) {
      setUploadError(e instanceof ImageUploadError ? e.message : 'Upload failed.');
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
    const refs = usage[image.id] ?? [];
    const detail = refs.length
      ? `It's still attached to ${refs.length} diagram${
          refs.length === 1 ? '' : 's'
        }: those tiles will render as broken images.`
      : 'The bytes are dropped from R2 and the gallery row removed. This cannot be undone.';
    const ok = await confirm({
      title: `Delete "${image.originalName ?? 'image'}"?`,
      message: detail,
      confirmLabel: 'Delete image',
    });
    if (!ok) return;
    try {
      await apiDeleteImage(ownerId, image.id);
      setGallery((prev) => (prev ? prev.filter((i) => i.id !== image.id) : prev));
      setUsage((prev) => {
        const { [image.id]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      });
    } catch {
      setGalleryError('Delete failed.');
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition ${
          dropActive
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40'
        }`}
      >
        <UploadIcon />
        <p className="text-sm font-medium text-slate-700">
          {uploading ? 'Uploading...' : 'Drop, paste, or click to upload an image'}
        </p>
        <p className="text-[11px] text-slate-500">
          PNG, JPEG, WebP, or GIF up to {UPLOAD_MAX_BYTES / (1024 * 1024)} MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {uploadError ? (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{uploadError}</p>
      ) : null}

      <div className="mt-6">
        {galleryError ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{galleryError}</p>
        ) : !gallery ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : gallery.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
            No images yet. Drop one above and it&apos;ll show up here.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((image) => (
              <GalleryCard
                key={image.id}
                image={image}
                ownerId={ownerId}
                usage={usage[image.id] ?? []}
                onDelete={() => handleDelete(image)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GalleryCard({
  image,
  ownerId,
  usage,
  onDelete,
}: {
  image: ImageSummary;
  ownerId: string;
  usage: { id: string; name: string }[];
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="group relative rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <GalleryImageButton
        image={image}
        ownerId={ownerId}
        // Owner-only context, no diagramId / shareCode needed: the
        // byte-read endpoint allows the image's owner unconditionally.
        diagramId=""
        onClick={() => setOpen((o) => !o)}
        ariaLabel={image.originalName ?? 'image'}
      />
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700">
            {image.originalName ?? 'Untitled image'}
          </p>
          <p className="text-[10px] text-slate-500">
            {image.width} × {image.height} · {formatBytes(image.byteSize)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${image.originalName ?? 'image'}`}
          className="rounded p-1 text-rose-700 transition hover:bg-rose-50"
        >
          <TrashIcon />
        </button>
      </div>
      <div className="mt-1">
        {usage.length === 0 ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Not used
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 transition hover:bg-brand-100"
            aria-expanded={open}
          >
            Used in {usage.length} {usage.length === 1 ? 'diagram' : 'diagrams'}
          </button>
        )}
      </div>
      {open && usage.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {usage.map((d) => (
            <li key={d.id} className="truncate text-[11px]">
              <a
                href={`/live/diagram/${encodeURIComponent(d.id)}`}
                className="text-brand-700 transition hover:text-brand-800 hover:underline"
              >
                {d.name || 'Untitled diagram'}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
      className="text-slate-500"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
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
