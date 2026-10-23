'use client';

import type { ReactNode } from 'react';
import { isIconCatalogsLoaded } from '@/lib/icon-registry';
import { iconBrowseGroups } from './IconPickerTab';
import { stickerBrowseGroups } from './StickerPickerTab';
import { techBrowseGroups } from './TechPickerTab';

// The browse groups of Icons, Stickers and Technology (PaletteCategoryBrowser), as a list of names and glyphs: an
// opener for one group (palette-openers) wears that group's glyph.

export type StripGroup = { id: string; label: string; icon: ReactNode };

// What an opener (palette-openers) opened: a category, or one of its catalogue groups. `key` names the opener.
export type StripOpen = {
  key: string;
  category: string;
  group: string | null;
};

/** The category's groups when it is a grouped catalogue, else null (a category of tiles). Empty groups (the
 *  catalogue chunk still in flight) are left out. */
export function catalogueStripGroups(categoryId: string): StripGroup[] | null {
  const cached = CACHE.get(categoryId);
  if (cached) return cached;
  const groups =
    categoryId === 'icons'
      ? iconBrowseGroups()
      : categoryId === 'stickers'
        ? stickerBrowseGroups()
        : categoryId === 'technology'
          ? techBrowseGroups()
          : null;
  if (!groups) return null;
  const strip = groups
    .filter((g) => g.items.length > 0)
    .map(({ id, label, icon }) => ({ id, label, icon }));
  // Built once the catalogues have landed, after which they never change: about 1 ms a build (Icons, Technology)
  // on every render of an opener's glyph otherwise.
  if (isIconCatalogsLoaded()) CACHE.set(categoryId, strip);
  return strip;
}

const CACHE = new Map<string, StripGroup[]>();
