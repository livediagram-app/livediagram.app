import { SPACE_CATEGORIES } from './space-categories';
import { tileCaption } from './tile-caption';
import {
  TOOL_GROUPS,
  type PaletteTileDef,
  type PaletteTileSection,
  type ToolGroupId,
} from './tile-defs/types';
import { SHAPE_TILES } from './tile-defs/shape-tiles';
import { WRITE_TILES } from './tile-defs/write-tiles';
import { ROOM_TILES } from './tile-defs/room-tiles';
import { AMENITY_TILES } from './tile-defs/amenity-tiles';
import { LEISURE_TILES } from './tile-defs/leisure-tiles';
import { MEETING_TILES } from './tile-defs/meeting-tiles';
import { MEDIA_TILES } from './tile-defs/media-tiles';

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
  ...WRITE_TILES,
  ...ROOM_TILES,
  ...AMENITY_TILES,
  ...LEISURE_TILES,
  ...MEETING_TILES,
  ...MEDIA_TILES,
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

// The meeting elements' categories (docs/specs/012-collaboration/workshop-mode.md "The palette"): each holds the
// `behaviour` tool group's tiles of one `tileGroup`, in catalogue order. The Space categories come from their one
// list (space-categories.tsx).
export const COLLABORATE_CATEGORY_GROUPS: Readonly<
  Record<string, NonNullable<PaletteTileDef['tileGroup']>>
> = {
  ...Object.fromEntries(SPACE_CATEGORIES.map((c) => [c.id, c.tileGroup])),
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
