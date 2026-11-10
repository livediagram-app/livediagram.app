import { tileCaption } from './tile-caption';
import {
  TOOL_GROUPS,
  type PaletteTileDef,
  type PaletteTileSection,
  type ToolGroupId,
} from './tile-defs/types';
import { SHAPE_TILES } from './tile-defs/shape-tiles';
import { TOOL_TILES } from './tile-defs/tool-tiles';
import { BEHAVIOUR_TILES } from './tile-defs/behaviour-tiles';
import { COLLABORATE_TILES } from './tile-defs/collaborate-tiles';
import { ELEMENT_TILES } from './tile-defs/element-tiles';
import { CONCEPT_TILES } from './tile-defs/concept-tiles';
import { DATA_TILES } from './tile-defs/data-tiles';
import { COMPONENT_TILES } from './tile-defs/component-tiles';
import { DEVICE_TILES } from './tile-defs/device-tiles';
import { EVENT_STORMING_TILES } from './tile-defs/event-storming-tiles';

export { TILE_GLYPH_PX, TOOL_GROUPS } from './tile-defs/types';
export type { PaletteTileDef, PaletteTileSection, ToolGroupId } from './tile-defs/types';

// The shared palette tile catalogue: every creation tile across the categories as one data
// entry — label, glyph, tinting flags, and an action descriptor that PaletteTileGrid maps to the
// editor's add-handlers. Every category body, Popular, the Toolbar strip and the Search panel
// render from this one catalogue (arranged per mode by palette-layouts.ts), so a tile is defined
// once and can never drift between the places it shows.
//
// Pure data, kept as one module per palette section in tile-defs/ (no god files): PALETTE_TILES
// joins them in catalogue order, so a new tile goes in its section's module.

export const PALETTE_TILES: PaletteTileDef[] = [
  ...SHAPE_TILES,
  ...TOOL_TILES,
  ...BEHAVIOUR_TILES,
  ...COLLABORATE_TILES,
  ...ELEMENT_TILES,
  ...CONCEPT_TILES,
  ...DATA_TILES,
  ...COMPONENT_TILES,
  ...DEVICE_TILES,
  ...EVENT_STORMING_TILES,
];

export function tilesInSection(section: PaletteTileSection): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === section);
}

// The Tools tab's grouped view (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"): the tools-section
// tiles carrying the given group, in catalogue order.
export function tilesInToolGroup(group: ToolGroupId): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === 'tools' && t.toolGroup === group);
}

export function tileById(id: string): PaletteTileDef | undefined {
  return PALETTE_TILES.find((t) => t.id === id);
}

// The tile's short human name: the explicit caption where one is set,
// otherwise derived from the action label the same way IconButton derives
// its tile caption ("Add Web Browser" → "Web Browser", "Pencil (freehand)"
// → "Pencil"). Used by the Search panel's add-to-canvas entries.
export function tileDisplayName(def: PaletteTileDef): string {
  return tileCaption(def.label, def.caption);
}

// The Collaborate elements' six categories (docs/specs/012-collaboration/workshop-mode.md "The palette"):
// each holds the `behaviour` tool group's tiles of one `tileGroup`, in catalogue order. Workshop
// offers them in place of one Collaborate category with a group browser inside it.
export const COLLABORATE_CATEGORY_GROUPS: Readonly<
  Record<string, NonNullable<PaletteTileDef['tileGroup']>>
> = {
  'collab-ask': 'ask',
  'collab-tools': 'tools',
  'collab-record': 'record',
  'collab-react': 'reaction',
  'collab-mode': 'mode',
  'collab-navigate': 'move',
};

/** The palette category a tile renders under by default: its section, its tool group inside
 *  Tools, or for a Collaborate element its group's category. The inverse of tilesForCategory. */
export function tileCategoryId(tile: PaletteTileDef): string {
  if (tile.section !== 'tools') return tile.section;
  if (tile.toolGroup === 'behaviour' && tile.tileGroup) {
    const id = Object.keys(COLLABORATE_CATEGORY_GROUPS).find(
      (c) => COLLABORATE_CATEGORY_GROUPS[c] === tile.tileGroup,
    );
    if (id) return id;
  }
  return tile.toolGroup ?? 'tools';
}

/**
 * The tiles a palette CATEGORY holds by default, which is not the same thing as a
 * section id. A mode's palette layout (palette-layouts.ts) starts from these and may
 * re-fill a category for that mode; ask the layout (paletteCategoriesFor) for what a
 * palette actually shows.
 *
 * Most categories are a section. Write and Draw are not: they are tool GROUPS
 * inside the tools section, and the six Collaborate categories are `tileGroup`s of
 * the Behaviour tool group (docs/specs/010-palette/palette-top-level-categories.md), so `tilesInSection('write')`
 * is empty and a caller that assumed otherwise silently showed nothing (the
 * since-removed Edit Favourites dialog did exactly that and dropped all three).
 *
 * Returns [] for the open-ended catalogues (Icons / Stickers / Technology),
 * whose contents are async data rather than fixed tiles — callers handle
 * those through their own search.
 */
export function tilesForCategory(categoryId: string): PaletteTileDef[] {
  const collaborate = COLLABORATE_CATEGORY_GROUPS[categoryId];
  if (collaborate) {
    return tilesInToolGroup('behaviour').filter((t) => t.tileGroup === collaborate);
  }
  if (TOOL_GROUPS.some((g) => g.id === categoryId)) {
    return tilesInToolGroup(categoryId as ToolGroupId);
  }
  return PALETTE_TILES.filter((t) => t.section === categoryId);
}
