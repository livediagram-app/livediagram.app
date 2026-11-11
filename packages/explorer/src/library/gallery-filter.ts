// The Image Gallery's Show switch (liveworkspace/docs/specs/004-index/one-explorer.md "The Library and Settings"):
// All, or Unused, the images nothing places (no "Used in" badge), read from the usage the Gallery already loads.
import type { GalleryImage, GalleryUse } from './types';

export type GalleryFilter = 'all' | 'unused';

/** Whether anything places the image, as the usage map says (an image with no entry, or none, is unused). */
export const isUnused = (usage: Record<string, GalleryUse[]>, id: string): boolean =>
  !usage[id]?.length;

/** The images the switch shows, in the gallery's own order: one pass, the list itself when nothing is left out. */
export function filterGallery(
  images: readonly GalleryImage[],
  usage: Record<string, GalleryUse[]>,
  filter: GalleryFilter,
): readonly GalleryImage[] {
  return filter === 'unused' ? images.filter((image) => isUnused(usage, image.id)) : images;
}
