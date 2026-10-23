// Photo pages in a tab (docs/specs/031-photo/photo-pages.md, photo-store.md "What is stored where"):
// a photo page's picture is `Tab.photos[pageId]`. Reading one (a page whose photo is missing reads as
// an empty transparent photo of the default size), writing one (its page's sheet following its
// size), and how many photo pages a tab may hold.
import {
  PHOTO_DEFAULT_HEIGHT,
  PHOTO_DEFAULT_WIDTH,
  PHOTO_MAX_PAGES,
  photosOf,
  type Photo,
} from '@livedesign/photo-engine';
import type { Tab } from './index';
import { pagesOf, photoSheetSides, withPages, type Page } from './page';

export { photosOf, type Photo } from '@livedesign/photo-engine';

type PhotosTab = { pages?: unknown; pageOrientation?: unknown; photos?: unknown };

/** An empty photo, no layers. */
export function blankPhoto(width = PHOTO_DEFAULT_WIDTH, height = PHOTO_DEFAULT_HEIGHT): Photo {
  return { width, height, layers: [] };
}

/** A photo page's picture; a page whose photo is missing reads as an empty default photo. */
export function photoOfPage(tab: PhotosTab, pageId: string): Photo {
  return photosOf(tab)[pageId] ?? blankPhoto();
}

/** Whether another photo page fits in the tab (at most PHOTO_MAX_PAGES). */
export function roomForPhotoPage(tab: PhotosTab): boolean {
  return pagesOf(tab).filter((p) => p.kind === 'photo').length < PHOTO_MAX_PAGES;
}

/** The tab with a photo page's picture set: its page's sheet takes the photo's shape when its size
 *  changed (the pages after it, and what is on them, moving as any page edit moves them). Same tab
 *  back when the page is not a photo page. */
export function withPhoto<T extends PhotosTab & Pick<Tab, 'elements'>>(
  tab: T,
  pageId: string,
  photo: Photo,
): T {
  const pages = pagesOf(tab);
  const page = pages.find((p) => p.id === pageId);
  if (!page || page.kind !== 'photo') return tab;
  const sides = photoSheetSides(photo.width, photo.height);
  const raw = (tab.photos && typeof tab.photos === 'object' ? tab.photos : {}) as Record<
    string,
    Photo
  >;
  const next: T = { ...tab, photos: { ...raw, [pageId]: photo } };
  if (page.fit && page.fit.width === sides.width && page.fit.height === sides.height) return next;
  const resized: Page = {
    ...page,
    fit: sides,
    orientation: sides.width >= sides.height ? 'landscape' : 'portrait',
  };
  return withPages(
    next,
    pages.map((p) => (p.id === pageId ? resized : p)),
  );
}

/** The tab with a photo page's picture gone (its page stays). */
export function withoutPhoto<T extends PhotosTab>(tab: T, pageId: string): T {
  const raw = tab.photos as Record<string, unknown> | undefined;
  if (!raw || !(pageId in raw)) return tab;
  const { [pageId]: _drop, ...rest } = raw;
  void _drop;
  const out = { ...tab } as T & { photos?: unknown };
  if (Object.keys(rest).length > 0) out.photos = rest;
  else delete out.photos;
  return out;
}
