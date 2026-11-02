// Make Sizes (docs/specs/031-photo/photo-pages.md "Making sizes"): the social formats, the ticks this
// browser remembers, and the photo in focus copied into each ticked format, its picture scaled to
// fill the format and cropped about the centre. Each copy is worked in a session of its own over the
// same pixels store (so the source's decoded tiles are read from memory), its tiles encoded and
// queued as any commit's are, its preview made, and handed back for the editor to add as new pages
// in one edit.
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import {
  PHOTO_MAX_PAGES,
  type Photo,
  type PixelsLookup,
  type Raster,
} from '@livedesign/photo-engine';
import { coverSize } from './image-ops';
import type { PixelsStore } from './pixels-store';
import { PhotoSession } from './session';

export type SizeFormatId =
  | 'instagram-post'
  | 'instagram-story'
  | 'linkedin-post'
  | 'linkedin-banner'
  | 'x-post'
  | 'x-header'
  | 'facebook-cover'
  | 'youtube-thumbnail'
  | 'custom';

export type SizeFormat = { id: SizeFormatId; name: string; width: number; height: number };

// Each platform's documented upload size (photo-pages.md "The formats", blueprint D29).
export const PHOTO_SIZE_FORMATS: readonly SizeFormat[] = [
  { id: 'instagram-post', name: 'Instagram Post', width: 1080, height: 1350 },
  { id: 'instagram-story', name: 'Instagram Story', width: 1080, height: 1920 },
  { id: 'linkedin-post', name: 'LinkedIn Post', width: 1200, height: 627 },
  { id: 'linkedin-banner', name: 'LinkedIn Banner', width: 1584, height: 396 },
  { id: 'x-post', name: 'X Post', width: 1600, height: 900 },
  { id: 'x-header', name: 'X Header', width: 1500, height: 500 },
  { id: 'facebook-cover', name: 'Facebook Cover', width: 851, height: 315 },
  { id: 'youtube-thumbnail', name: 'YouTube Thumbnail', width: 1280, height: 720 },
];

export const CUSTOM_SIZE_DEFAULT = { width: 1080, height: 1080 };

/** How many more photo pages a tab with `photoPages` of them takes. */
export const sizesRoom = (photoPages: number): number => Math.max(0, PHOTO_MAX_PAGES - photoPages);

/** The formats ticked, in the dialog's order, Custom last at its own size. */
export function sizeTargets(
  ticked: ReadonlySet<SizeFormatId>,
  custom: { width: number; height: number },
): SizeFormat[] {
  return [
    ...PHOTO_SIZE_FORMATS.filter((f) => ticked.has(f.id)),
    ...(ticked.has('custom') ? [{ id: 'custom' as const, name: 'Custom', ...custom }] : []),
  ];
}

// The ticks, kept in this browser for the next time (none the first time).
const TICKS_KEY = 'livedesign:photo-make-sizes';
const IDS = new Set<string>([...PHOTO_SIZE_FORMATS.map((f) => f.id), 'custom']);
const side = (v: unknown, d: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : d;

export type SizeTicks = { ticked: SizeFormatId[]; custom: { width: number; height: number } };

export const sizeTicks = {
  get(): SizeTicks {
    try {
      const raw = globalThis.localStorage?.getItem(TICKS_KEY);
      const v = raw ? (JSON.parse(raw) as Partial<SizeTicks>) : {};
      return {
        ticked: Array.isArray(v.ticked) ? v.ticked.filter((id) => IDS.has(id)) : [],
        custom: {
          width: side(v.custom?.width, CUSTOM_SIZE_DEFAULT.width),
          height: side(v.custom?.height, CUSTOM_SIZE_DEFAULT.height),
        },
      };
    } catch {
      return { ticked: [], custom: { ...CUSTOM_SIZE_DEFAULT } };
    }
  },
  set(next: SizeTicks): void {
    try {
      globalThis.localStorage?.setItem(TICKS_KEY, JSON.stringify(next));
    } catch {
      // A full or blocked store: the dialog still works for the session.
    }
  },
};

export type MadeSize = { id: string; name: string; photo: Photo };

export type MakeSizesDeps = {
  tabId: string;
  store: PixelsStore;
  enqueue: (tabId: string, entries: PhotoBlobEntry[]) => void;
  // A new page's id for each size, in order.
  newId: () => string;
  // The dialog was closed: stop, adding nothing.
  cancelled: () => boolean;
  // The preview's picture and its file (preview.ts), injected so tests run without a worker.
  previewRaster: (photo: Photo, pixels: PixelsLookup) => Promise<Raster | null>;
  encodePreview: (r: Raster) => Promise<PhotoBlobEntry | null>;
  // Each size done, for the dialog's progress.
  progress?: (done: number) => void;
};

const noop = () => {};
const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/** The source photo copied into each format; null when cancelled or refused (a size past the cap). */
export async function makeSizes(
  source: PhotoSession,
  formats: readonly SizeFormat[],
  deps: MakeSizesDeps,
): Promise<MadeSize[] | null> {
  await source.settled();
  await source.whenLoaded();
  const from = source.photo;
  const made: MadeSize[] = [];
  for (const f of formats) {
    if (deps.cancelled()) return null;
    const id = deps.newId();
    let photo: Photo | null = null;
    const s = new PhotoSession(from, {
      tabId: deps.tabId,
      pageId: id,
      store: deps.store,
      enqueue: deps.enqueue,
      commit: (p) => {
        photo = p;
      },
      checkpoint: noop,
      cancelCheckpoint: noop,
      endCheckpoint: noop,
    });
    try {
      await s.whenLoaded();
      if (await coverSize(s, f.width, f.height)) return null;
      await s.settled();
      const r = await deps.previewRaster(s.photo, s.lookup());
      const entry = r ? await deps.encodePreview(r) : null;
      if (r && entry) {
        deps.store.put(
          entry.id,
          r.data,
          new Blob([entry.bytes as Uint8Array<ArrayBuffer>], { type: entry.type }),
        );
        deps.enqueue(deps.tabId, [entry]);
      }
      // The source's own preview is never carried: it is the wrong shape for this size.
      const { preview: _was, ...done } = (photo as Photo | null) ?? s.photo;
      void _was;
      made.push({ id, name: f.name, photo: entry ? { ...done, preview: entry.id } : done });
    } finally {
      // Its resampled pixels let go before the next size begins.
      s.dispose();
    }
    deps.progress?.(made.length);
    // The page draws a frame between sizes.
    await nextFrame();
  }
  return deps.cancelled() ? null : made;
}
