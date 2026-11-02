'use client';

import { PALETTE_CATEGORIES } from './palette-categories';
import type { PaletteTileDef, PaletteTileSection } from './palette-tile-defs';

// Openers (docs/specs/007-editor/editor-modes.md "The palette per mode"): a tile in a layout's list that stands for a
// whole category rather than one element. On the Toolbar strip it is drawn as an opener
// (its glyph with a chevron) and opens a popover of what it stands for, as a catalogue's groups do
// (docs/specs/007-editor/toolbar-layout.md "More"); elsewhere pressing it moves the palette to its category. Listed by
// id beside the tile ids, so a layout places one exactly where a tile would go.

type Opener = {
  // The PALETTE_CATEGORIES id it opens.
  category: string;
  label: string;
  section: PaletteTileSection;
};

const OPENERS: Record<string, Opener> = {
  'open:collab-ask': { category: 'collab-ask', label: 'Ask', section: 'tools' },
  'open:collab-tools': { category: 'collab-tools', label: 'Tools', section: 'tools' },
  'open:collab-record': { category: 'collab-record', label: 'Record', section: 'tools' },
  'open:collab-react': { category: 'collab-react', label: 'React', section: 'tools' },
};

/** The opener tile with this id, or undefined (not an opener). */
export function openerById(id: string): PaletteTileDef | undefined {
  const o = OPENERS[id];
  if (!o) return undefined;
  return {
    id,
    section: o.section,
    label: o.label,
    description: `Open ${o.label}.`,
    icon: PALETTE_CATEGORIES.find((c) => c.id === o.category)?.icon ?? null,
    action: { type: 'open', category: o.category },
  };
}
