// The Image Gallery's Show switch (liveworkspace/docs/specs/004-index/one-explorer.md "The Library and Settings"):
// All, or Unused, the images checked and found placed nowhere, read from the usage the Gallery already loads. An image
// whose usage could not be checked is never unused (liveworkspace/docs/specs/006-media/media.md "Usage"), and nor is one a
// Library item holds (liveworkspace/docs/specs/006-media/libraries.md "Pictures").
import type { GalleryImage, GalleryUsage } from './types';

export type GalleryFilter = 'all' | 'unused';

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

/** The images the switch shows, in the gallery's own order: one pass, the list itself when nothing is left out. */
export function filterGallery(
  images: readonly GalleryImage[],
  usage: GalleryUsage,
  filter: GalleryFilter,
): readonly GalleryImage[] {
  return filter === 'unused' ? images.filter((image) => isUnused(usage, image.id)) : images;
}
