'use client';

// A form's picture picker (docs/specs/030-forms/forms.md "Cover", "Content blocks"): Upload (a file from this device,
// dropped or chosen), Your Images (the person's gallery, every app's pictures) and Search (openly licensed pictures
// from Openverse, credited). Whatever is picked is stored for this plan (uploaded, or claimed from the gallery), so
// the plan serves it to the form's builder and its link. Opened over the builder by Change Cover and a picture block.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DialogCloseButton, DialogHeader } from '@liveworkspace/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogTabs } from '@liveworkspace/workbench/components/dialogs/DialogTabs';
import { createImageSearchPane } from '@liveworkspace/workbench/components/image-search/ImageSearchPane';
import { creditFor } from '@liveworkspace/workbench/lib/image-search/openverse';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideImagePlus } from '@liveworkspace/icons/lucide';
import {
  IMAGE_ACCEPT,
  IMAGE_THUMB_EDGE,
  ImageUploadError,
  apiClaimImage,
  apiImageUrl,
  apiListGallery,
  apiUploadImage,
  releaseImageUrl,
  type ImageSummary,
} from '@/lib/api/images';
import { setImageSearchScope, useImageSearch } from '@/hooks/ui/useImageSearch';
import { track } from '@/lib/telemetry';
import { useFormBuilder } from './form-builder-context';

const ImageSearchPane = createImageSearchPane(useImageSearch);
const AddIcon = lucideGlyph(lucideImagePlus, 28);

type Tab = 'upload' | 'gallery' | 'search';
const TAB_LABELS: Record<Tab, string> = {
  upload: 'Upload',
  gallery: 'Your Images',
  search: 'Search',
};

// What the picker hands back: the stored picture, and a Search pick's credit line.
export type FormPicked = { id: string; credit?: string };

export function FormImagePicker({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (picked: FormPicked) => void;
  onClose: () => void;
}) {
  const b = useFormBuilder();
  const scope = b.images ?? null;
  const [tab, setTab] = useState<Tab>('upload');
  const idPrefix = useId();
  useEffect(() => {
    setImageSearchScope(scope);
    return () => setImageSearchScope(null);
  }, [scope]);
  return (
    <Dialog open onClose={onClose} size="2xl" titleId={`${idPrefix}-title`} phoneSheet="tall">
      <DialogHeader
        title={<span id={`${idPrefix}-title`}>{title}</span>}
        subtitle="It shows on the form for everyone who opens its link."
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <DialogTabs
        tabs={['upload', 'gallery', 'search'] as const}
        labels={TAB_LABELS}
        value={tab}
        onChange={setTab}
        idPrefix={idPrefix}
        ariaLabel="Where the picture comes from"
      />
      <div
        role="tabpanel"
        id={`${idPrefix}-panel-${tab}`}
        aria-labelledby={`${idPrefix}-tab-${tab}`}
        className="min-h-[22rem] overflow-y-auto px-6 py-5 max-sm:px-4"
      >
        {!scope ? (
          <p className="text-[14px] text-slate-600 dark:text-slate-300">
            Pictures can be added once this plan is saved to liveplanner.
          </p>
        ) : tab === 'upload' ? (
          <UploadPane scope={scope} onPick={onPick} />
        ) : tab === 'gallery' ? (
          <GalleryPane scope={scope} onPick={onPick} />
        ) : (
          <ImageSearchPane
            ownerId={scope.ownerId}
            documentId={scope.projectId}
            onPicked={(image, result) => {
              track('Form', 'Added', 'PictureSearch');
              const credit = creditFor(result)?.text;
              onPick({ id: image.id, ...(credit ? { credit } : {}) });
            }}
          />
        )}
      </div>
    </Dialog>
  );
}

type Scope = NonNullable<ReturnType<typeof useFormBuilder>['images']>;

function UploadPane({ scope, onPick }: { scope: Scope; onPick: (p: FormPicked) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { image } = await apiUploadImage(scope, file);
      track('Form', 'Added', 'PictureUpload');
      onPick({ id: image.id });
    } catch (e) {
      setError(
        e instanceof ImageUploadError ? e.message : 'The image couldn’t be uploaded. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files[0]);
        }}
        className={`flex h-64 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition disabled:cursor-wait ${
          over
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/40 dark:hover:bg-slate-800'
        }`}
      >
        {busy ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600 motion-reduce:animate-none" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300">
            <AddIcon aria-hidden />
          </span>
        )}
        <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
          {busy ? 'Uploading…' : 'Drop a picture here, or choose one'}
        </span>
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          PNG, JPEG, WebP or GIF. A wide picture suits a cover best.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GalleryPane({ scope, onPick }: { scope: Scope; onPick: (p: FormPicked) => void }) {
  const [images, setImages] = useState<ImageSummary[] | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void apiListGallery(scope.ownerId).then((list) => {
      if (live) setImages(list);
    });
    return () => {
      live = false;
    };
  }, [scope.ownerId]);
  const pick = async (image: ImageSummary) => {
    if (claiming) return;
    setClaiming(image.id);
    setError(null);
    try {
      await apiClaimImage(scope, image.id);
      track('Form', 'Added', 'PictureGallery');
      onPick({ id: image.id });
    } catch {
      setError('That picture couldn’t be added. Try again.');
    } finally {
      setClaiming(null);
    }
  };
  if (images === null)
    return (
      <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-3">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="aspect-square animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  if (images.length === 0)
    return (
      <p className="py-16 text-center text-[14px] text-slate-500 dark:text-slate-400">
        No pictures yet. Upload one, or find one in Search.
      </p>
    );
  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 text-[13px] font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-4 gap-2 max-sm:grid-cols-3">
        {images.map((image) => (
          <li key={image.id}>
            <button
              type="button"
              disabled={!!claiming}
              onClick={() => void pick(image)}
              aria-label={`Use ${image.originalName ?? 'this picture'}`}
              className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-slate-100 ring-brand-500 transition hover:ring-2 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait dark:bg-slate-800"
            >
              <GalleryThumb scope={scope} imageId={image.id} />
              {claiming === image.id ? (
                <span className="absolute inset-0 grid place-items-center bg-white/60 dark:bg-slate-900/60">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600 motion-reduce:animate-none" />
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A gallery picture's thumbnail, read as its uploader (the gallery is the person's own).
function GalleryThumb({ scope, imageId }: { scope: Scope; imageId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const own = useMemo(() => ({ ...scope, projectId: '' }), [scope]);
  useEffect(() => {
    let live = true;
    let got: string | null = null;
    void apiImageUrl(own, imageId, { maxEdge: IMAGE_THUMB_EDGE * 8 }).then((s) => {
      got = s;
      if (live) setSrc(s);
      else if (s) releaseImageUrl(s);
    });
    return () => {
      live = false;
      if (got) releaseImageUrl(got);
    };
  }, [own, imageId]);
  return src ? (
    <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : null;
}
