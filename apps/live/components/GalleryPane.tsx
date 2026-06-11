'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDeleteImage, apiImageUsage, apiListImages, type ImageSummary } from '@/lib/api-client';
import { ImageUploadError, uploadImageFile } from '@/lib/upload-image';
import { useConfirm } from '@/hooks/useConfirm';
import { TrashIcon } from './explorer-icons';
import { GalleryImageButton } from './GalleryImageButton';
import { ImageDropZone } from './ImageDropZone';

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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  const handleDelete = async (image: ImageSummary) => {
    const refs = usage[image.id] ?? [];
    const detail = refs.length
      ? `It's still attached to ${refs.length} diagram${
          refs.length === 1 ? '' : 's'
        }: those tiles will render as broken images.`
      : 'This image will be permanently removed from your gallery. This can’t be undone.';
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

  const onSelectFile = async (file: File) => {
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

  return (
    <div>
      <ImageDropZone
        onSelectFile={onSelectFile}
        uploading={uploading}
        error={uploadError}
        prompt="Drop, paste, or click to upload an image"
      />

      <div className="mt-6">
        {galleryError ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{galleryError}</p>
        ) : !gallery ? (
          <p className="text-xs text-slate-500">Loading…</p>
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
          <TrashIcon strokeWidth={1.6} />
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
                href={`/diagram/${encodeURIComponent(d.id)}`}
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
