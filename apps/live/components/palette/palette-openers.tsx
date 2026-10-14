'use client';

import { useSyncExternalStore } from 'react';
import { isIconCatalogsLoaded, subscribeIconCatalogs } from '@/lib/icon-registry';
import { PALETTE_CATEGORIES } from './palette-categories';
import { catalogueStripGroups } from './catalogue-strip-groups';
import type { PaletteTileDef, PaletteTileSection } from './palette-tile-defs';

// Openers (docs/specs/007-editor/editor-modes.md "The palette per mode"): a tile in a layout's list that stands for a
// whole category, or one group of a catalogue, rather than one element. On the Toolbar strip it is drawn as an opener
// (its glyph with a chevron) and opens a popover of what it stands for, as a catalogue's groups do
// (docs/specs/007-editor/toolbar-layout.md "More"); elsewhere pressing it moves the palette to its category. Listed by
// id beside the tile ids, so a layout places one exactly where a tile would go.

type Opener = {
  // The PALETTE_CATEGORIES id it opens.
  category: string;
  // One of a catalogue's browse groups (catalogueStripGroups), opened alone; absent for the whole category.
  group?: string;
  label: string;
  section: PaletteTileSection;
};

const OPENERS: Record<string, Opener> = {
  'open:technology/aws': {
    category: 'technology',
    group: 'aws',
    label: 'AWS',
    section: 'technology',
  },
  'open:collab-ask': { category: 'collab-ask', label: 'Ask', section: 'tools' },
  'open:collab-tools': { category: 'collab-tools', label: 'Tools', section: 'tools' },
  'open:collab-record': { category: 'collab-record', label: 'Record', section: 'tools' },
  'open:collab-react': { category: 'collab-react', label: 'React', section: 'tools' },
};

// Drawn at render, so a catalogue group's artwork (its first entry) appears once the catalogue chunk lands.
function OpenerIcon({ category, group }: { category: string; group?: string | undefined }) {
  // Redraws as the catalogues arrive (the editor starts the load as it opens).
  useSyncExternalStore(subscribeIconCatalogs, isIconCatalogsLoaded, () => false);
  if (group)
    return <>{catalogueStripGroups(category)?.find((g) => g.id === group)?.icon ?? null}</>;
  return <>{PALETTE_CATEGORIES.find((c) => c.id === category)?.icon ?? null}</>;
}

/** The opener tile with this id, or undefined (not an opener). */
export function openerById(id: string): PaletteTileDef | undefined {
  const o = OPENERS[id];
  if (!o) return undefined;
  return {
    id,
    section: o.section,
    label: o.label,
    description: `Open ${o.label}.`,
    icon: <OpenerIcon category={o.category} group={o.group} />,
    action: { type: 'open', category: o.category, ...(o.group ? { group: o.group } : {}) },
  };
}
