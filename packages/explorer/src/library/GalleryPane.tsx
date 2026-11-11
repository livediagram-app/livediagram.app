'use client';

// The Image Gallery (livediagram's GalleryPane): every image the person has added, from the host's media source,
// each with its size, a "Used in" chip naming the items that place it (so orphaned bytes are easy to spot), and
// Delete. Upload by dropping, pasting or choosing a file, where the host takes uploads. Two reads on arrival (the
// list and the usage), each tile's picture only as it nears the screen (./blobs). The page's Show switch (All or
// Unused, ./gallery-filter) filters what those reads brought, never reading again.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IMAGE_ACCEPT_ATTR } from '@liveworkspace/api-schema/image-limits';
import { Button, ConfirmDialog, EmptyState, HoverCard } from '@liveworkspace/ui';
import { TrashIcon } from '../ui/icons';
import { ImageIcon, UploadIcon } from '../ui/library-icons';
import { isAbort } from '../data/errors';
import { useBlobUrl } from './blobs';
import { filterGallery, isUnchecked, UNKNOWN_USAGE, type GalleryFilter } from './gallery-filter';
import type { GalleryHost, GalleryImage, GalleryUsage, GalleryUse } from './types';
import { quoted } from '../quoted';

type Loaded =
  | { status: 'loading' }
  | { status: 'off' }
  | { status: 'failed' }
  | { status: 'ready'; images: GalleryImage[]; usage: GalleryUsage };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const imageName = (image: GalleryImage) => image.name || 'Untitled image';

// "3 canvases" when every use is the host's kind; "3 items" once another app's item is among them.
function countOf(usage: GalleryUse[], kindMany: { one: string; many: string }): string {
  const n = usage.length;
  const words = usage.some((u) => u.app) ? { one: 'item', many: 'items' } : kindMany;
  return `${n} ${n === 1 ? words.one : words.many}`;
}

/** The gallery's list and usage, read once and again after an upload; nothing is read without a host. */
export function useGallery(host: GalleryHost | undefined) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!host) return;
    const controller = new AbortController();
    const { signal } = controller;
    // A usage read that fails checks nothing: no image reads unused for it.
    const usage = host.usage?.(signal).catch(() => UNKNOWN_USAGE) ?? UNKNOWN_USAGE;
    Promise.all([host.list(signal), usage]).then(
      ([images, usage]) => {
        if (signal.aborted) return;
        setLoaded(images === null ? { status: 'off' } : { status: 'ready', images, usage });
      },
      (e: unknown) => {
        if (!isAbort(e)) setLoaded({ status: 'failed' });
      },
    );
    return () => controller.abort();
  }, [host, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const drop = useCallback(
    (id: string) =>
      setLoaded((l) =>
        l.status === 'ready' ? { ...l, images: l.images.filter((i) => i.id !== id) } : l,
      ),
    [],
  );
  return { loaded, reload, drop };
}

export type GalleryState = ReturnType<typeof useGallery>;

/** How many of the loaded images were checked and found placed nowhere, or null before the gallery (and its
 *  usage) is ready. */
export function unusedCount(host: GalleryHost, loaded: GalleryState['loaded']): number | null {
  if (!host.usage || loaded.status !== 'ready' || loaded.images.length === 0) return null;
  return filterGallery(loaded.images, loaded.usage, 'unused').length;
}

/** The Gallery on its own, reading its images itself (the editor panel's compact Gallery). */
export function GalleryPane({
  host,
  kindMany,
  compact = false,
}: {
  host: GalleryHost;
  // The items that place images ("canvases", or "items" across apps), for "Used in 3 canvases".
  kindMany: { one: string; many: string };
  compact?: boolean;
}) {
  const gallery = useGallery(host);
  return <GalleryContent host={host} gallery={gallery} kindMany={kindMany} compact={compact} />;
}

/** The Gallery over a state its page holds (./LibraryViews, whose header's Show switch reads the same state). */
export function GalleryContent({
  host,
  gallery,
  kindMany,
  compact = false,
  filter = 'all',
  onShowAll,
}: {
  host: GalleryHost;
  gallery: GalleryState;
  kindMany: { one: string; many: string };
  compact?: boolean;
  // The Show switch's choice: Unused keeps only the images nothing places.
  filter?: GalleryFilter;
  // Back to All, from the empty state when every image is in use.
  onShowAll?: () => void;
}) {
  const { loaded, reload, drop } = gallery;
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<GalleryImage | null>(null);
  const grid = compact
    ? 'grid grid-cols-3 gap-2.5 @[38rem]:grid-cols-5'
    : 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4';
  const usageOf = (id: string) => (loaded.status === 'ready' ? (loaded.usage.uses[id] ?? []) : []);
  const uncheckedOf = (id: string) => loaded.status === 'ready' && isUnchecked(loaded.usage, id);
  // One pass over at most the gallery's cap, again only when the list, its usage or the switch changes.
  const shown = useMemo(
    () => (loaded.status === 'ready' ? filterGallery(loaded.images, loaded.usage, filter) : []),
    [loaded, filter],
  );
  // Only worked out when the Unused list comes up empty.
  const anyUnchecked =
    shown.length === 0 &&
    loaded.status === 'ready' &&
    loaded.images.some((image) => isUnchecked(loaded.usage, image.id));

  const remove = (image: GalleryImage) => {
    setDeleting(null);
    drop(image.id);
    host.remove(image).catch(() => {
      setError('Delete failed.');
      reload();
    });
  };

  return (
    <div data-explorer-gallery="">
      {host.upload ? (
        <UploadZone
          upload={host.upload}
          compact={compact}
          onUploaded={() => {
            setError(null);
            reload();
          }}
        />
      ) : null}
      <div className={host.upload ? 'mt-4' : ''}>
        {error ? <Note>{error}</Note> : null}
        {loaded.status === 'loading' ? (
          <ul className={grid} aria-busy="true" aria-label="Loading images">
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                aria-hidden
                className="aspect-square animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
              />
            ))}
          </ul>
        ) : loaded.status === 'off' ? (
          <Note>Images are not enabled here.</Note>
        ) : loaded.status === 'failed' ? (
          <Note>
            Couldn’t load your gallery.{' '}
            <button type="button" onClick={reload} className="font-semibold underline">
              Try again
            </button>
          </Note>
        ) : loaded.images.length === 0 ? (
          <EmptyState
            compact={compact}
            icon={<ImageIcon size={28} />}
            title="No images yet"
            description={`Every image you add to a ${kindMany.one} collects here, ready to reuse in any of them.`}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            compact={compact}
            icon={<ImageIcon size={28} />}
            title="No unused images"
            description={
              anyUnchecked
                ? 'Where some images are used couldn’t be checked just now, so none of them are listed here. Open the gallery again to retry.'
                : `Every image here is placed in a ${kindMany.one} or another app’s item, so there is nothing to clear.`
            }
          >
            {onShowAll ? (
              <Button size="sm" variant="secondary" onClick={onShowAll}>
                Show All Images
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <ul className={grid} aria-label={filter === 'unused' ? 'Unused images' : 'Images'}>
            {shown.map((image) => (
              <GalleryCard
                key={image.id}
                host={host}
                image={image}
                usage={usageOf(image.id)}
                unchecked={uncheckedOf(image.id)}
                kindMany={kindMany}
                onDelete={() => setDeleting(image)}
              />
            ))}
          </ul>
        )}
      </div>
      {deleting ? (
        <ConfirmDialog
          open
          title={`Delete ${quoted(imageName(deleting))}?`}
          message={
            usageOf(deleting.id).length
              ? `It’s still in ${countOf(usageOf(deleting.id), kindMany)}: those will show a broken picture.`
              : uncheckedOf(deleting.id)
                ? 'We couldn’t check where it’s used: anything that places it will show a broken picture. This can’t be undone.'
                : 'This image will be removed from your gallery for good. This can’t be undone.'
          }
          confirmLabel="Delete Image"
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      ) : null}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}

function GalleryCard({
  host,
  image,
  usage,
  unchecked,
  kindMany,
  onDelete,
}: {
  host: GalleryHost;
  image: GalleryImage;
  usage: GalleryUse[];
  // Its usage couldn't be checked: neither used nor "Not used".
  unchecked: boolean;
  kindMany: { one: string; many: string };
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = imageName(image);
  const { ref, state } = useBlobUrl<HTMLButtonElement>(image.id, (signal) =>
    host.imageBlob(image, signal),
  );
  return (
    <li
      data-gallery-image={image.id}
      className="group relative rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={name}
        className="block aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-500/60"
      >
        {state.status === 'ready' ? (
          <img src={state.src} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : state.status === 'broken' ? (
          <span className="block h-full w-full bg-rose-50 dark:bg-rose-500/15" />
        ) : (
          <span className="block h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800" />
        )}
      </button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{name}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {image.width} × {image.height} · {formatBytes(image.byteSize)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <TrashIcon />
        </button>
      </div>
      <div className="mt-1">
        {usage.length === 0 ? (
          <HoverCard
            title={unchecked ? 'Couldn’t check' : 'Not used'}
            description={
              unchecked
                ? 'Where this image is used couldn’t be checked just now. Open the gallery again to retry.'
                : 'Nothing of yours, in any app, places this image.'
            }
          >
            <span
              tabIndex={0}
              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {unchecked ? 'Couldn’t check' : 'Not used'}
            </span>
          </HoverCard>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
          >
            Used in {countOf(usage, kindMany)}
          </button>
        )}
      </div>
      {open && usage.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          {usage.map((d) => (
            <li key={`${d.app ?? ''} ${d.id}`} className="truncate text-[11px]">
              {d.href ? (
                <a
                  href={d.href}
                  className="text-brand-700 transition hover:text-brand-800 hover:underline dark:text-brand-300 dark:hover:text-brand-200"
                >
                  {d.title || 'Untitled'}
                </a>
              ) : (
                <span className="text-slate-600 dark:text-slate-300">{d.title || 'Untitled'}</span>
              )}
              {d.app ? (
                <span className="text-slate-500 dark:text-slate-400"> in {d.app}</span>
              ) : null}
              {d.trashed ? (
                <span className="text-slate-500 dark:text-slate-400"> (in the Trash)</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Drop, paste or choose an image; the host checks and stores it, and its refusal is said as it is. */
function UploadZone({
  upload,
  compact,
  onUploaded,
}: {
  upload: (file: File) => Promise<void>;
  compact: boolean;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    try {
      await upload(file);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void send(e.dataTransfer.files[0]);
        }}
        onPaste={(e) => void send(e.clipboardData.files[0])}
        aria-busy={busy}
        className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm transition ${
          compact ? 'h-28 gap-1.5' : 'h-36 gap-2'
        } ${
          over
            ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
            : 'border-slate-300 bg-slate-50/60 text-slate-500 hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400'
        }`}
      >
        <UploadIcon size={18} />
        <span>{busy ? 'Uploading…' : 'Drop, paste, or click to upload an image'}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        className="hidden"
        aria-label="Upload an image"
        onChange={(e) => {
          void send(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
