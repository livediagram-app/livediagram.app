// The Image Gallery's filters (liveworkspace/docs/specs/004-index/one-explorer.md "The Library and Settings"): its
// Show chips, All, Unused (the images checked and found placed nowhere) or one app (the images that app's items
// place), and its name field, all read from the list and the usage the Gallery already loads. An image whose usage
// could not be checked is never unused (liveworkspace/docs/specs/006-media/media.md "Usage"), and nor is one a
// Library item holds (liveworkspace/docs/specs/006-media/libraries.md "Pictures").
import { APP_NAMES, isAppName, type AppName } from '@liveworkspace/sites';
import type { GalleryImage, GalleryUsage, GalleryUse } from './types';

/** All, Unused, or the images one app's items place (Work Tracker 1491). */
export type GalleryFilter = 'all' | 'unused' | AppName;

/** Usage nothing could be checked against: every image is unchecked. */
export const UNKNOWN_USAGE: GalleryUsage = { uses: {}, unchecked: 'all' };

/** Whether the image has no uses only because its usage could not be checked. */
export const isUnchecked = (usage: GalleryUsage, id: string): boolean =>
  !usage.uses[id]?.length && (usage.unchecked === 'all' || usage.unchecked.has(id));

/** Whether a Library item holds the image (it may be placed nowhere else). */
export const isLibraryHeld = (usage: GalleryUsage, id: string): boolean =>
  usage.library?.has(id) ?? false;

/** Whether nothing places the image, as checked: no uses, not unchecked, and no Library item holds it. */
export const isUnused = (usage: GalleryUsage, id: string): boolean =>
  !usage.uses[id]?.length && !isUnchecked(usage, id) && !isLibraryHeld(usage, id);

/** The app a use's item is in: the one it names, else the host's own (an older api names none). */
export const appOfUse = (use: GalleryUse, host: AppName): AppName =>
  isAppName(use.app) ? use.app : host;

/** The image's name as the Gallery shows it. */
export const imageName = (image: Pick<GalleryImage, 'name'>): string =>
  image.name || 'Untitled image';

/** The name field's words, lower-cased and split on spaces; empty matches every image. */
export function nameWords(query: string): string[] {
  const words: string[] = [];
  for (const word of query.toLocaleLowerCase().split(' ')) if (word) words.push(word);
  return words;
}

/** Whether every word is in the image's name, wherever it falls ("logo dark" finds "Dark Logo v2.png"). */
export const nameMatches = (image: Pick<GalleryImage, 'name'>, words: readonly string[]) => {
  if (words.length === 0) return true;
  const name = imageName(image).toLocaleLowerCase();
  return words.every((word) => name.includes(word));
};

const placedBy = (usage: GalleryUsage, id: string, app: AppName, host: AppName) =>
  usage.uses[id]?.some((use) => appOfUse(use, host) === app) ?? false;

/** The images the filters show, in the gallery's own order: one pass, the list itself when nothing is left out.
 *  `host` is the app whose Gallery it is, for uses an older api names no app for. */
export function filterGallery(
  images: readonly GalleryImage[],
  usage: GalleryUsage,
  filter: GalleryFilter,
  { query = '', host = 'livediagram' }: { query?: string; host?: AppName } = {},
): readonly GalleryImage[] {
  const words = nameWords(query);
  if (filter === 'all' && words.length === 0) return images;
  return images.filter(
    (image) =>
      nameMatches(image, words) &&
      (filter === 'all'
        ? true
        : filter === 'unused'
          ? isUnused(usage, image.id)
          : placedBy(usage, image.id, filter, host)),
  );
}

/** The Show chips' counts: how many images are unused, and for each app whose items place any, how many it places
 *  (an image placed in two apps counts in both), in the Explorer's order of apps. One pass over the usage. */
export function galleryCounts(
  images: readonly GalleryImage[],
  usage: GalleryUsage,
  host: AppName,
): { unused: number; apps: { app: AppName; count: number }[] } {
  let unused = 0;
  const byApp = new Map<AppName, number>();
  for (const image of images) {
    const uses = usage.uses[image.id];
    if (!uses?.length) {
      if (isUnused(usage, image.id)) unused += 1;
      continue;
    }
    const seen = new Set<AppName>();
    for (const use of uses) seen.add(appOfUse(use, host));
    for (const app of seen) byApp.set(app, (byApp.get(app) ?? 0) + 1);
  }
  return {
    unused,
    apps: APP_NAMES.filter((app) => byApp.has(app)).map((app) => ({
      app,
      count: byApp.get(app)!,
    })),
  };
}
