// Assembles the palette catalogue into the flat, keyword-tagged list the global search surfaces as "Add to canvas"
// results (docs/specs/026-plan/plan-mode.md "The palette"). Built here, not in lib/search.ts, so the search matcher
// stays catalogue-agnostic and the Explorer (which never adds elements) doesn't pull the tile data into its bundle.

import type { ShapeKind } from '@liveplanner/document';

import { tileKeywords } from '@/lib/palette-tile-keywords';
import type { PaletteSearchItem } from '@/lib/search';
import {
  PALETTE_TILES,
  tileDisplayName,
  type PaletteTileDef,
} from '@/components/palette/palette-tile-defs';

// The shape-placing tiles, in palette order. Derived from the shared
// catalogue (palette-tile-defs) rather than restated, which is what keeps search from
// drifting behind the palette again. Icon / sticker / tech tiles are excluded
// deliberately: Plan offers no icon or sticker catalogue to add from.
export const SHAPE_TILES = PALETTE_TILES.filter(
  (t) => t.action.type === 'shape' && t.action.kind !== 'icon' && t.action.kind !== 'sticker',
);

// One shape tile as a search item. Also read by the whiteboard's More shapes
// search (lib/whiteboard-shape-catalogue.ts), so both searches find a shape by
// the same words.
export function shapeTileSearchItem(tile: PaletteTileDef) {
  const action = tile.action as {
    type: 'shape';
    kind: ShapeKind;
    session?: string;
    reaction?: string;
    mode?: string;
    estimateScale?: string;
    plan?: string;
    variant?: string;
  };
  const kind = action.kind;
  // Keyed on the CHOICE where there is one, not just the kind: the five
  // reaction tiles and the three session tiles all place the same shape,
  // so keying on kind alone gave eight results three distinct ids and the
  // panel silently dropped the duplicates.
  const choice =
    action.session ??
    action.reaction ??
    action.mode ??
    action.estimateScale ??
    action.plan ??
    action.variant;
  return {
    id: choice ? `shape:${kind}:${choice}` : `shape:${kind}`,
    name: tileDisplayName(tile),
    // The tile's own description joins the keywords, so the sentence the
    // palette already writes about an element ("a titled band that carries
    // its contents") is searchable without being written twice.
    keywords: tileKeywords(tile),
    add: {
      type: 'shape' as const,
      shapeKind: kind,
      ...(action.session ? { session: action.session as never } : {}),
      ...(action.reaction ? { reaction: action.reaction as never } : {}),
      ...(action.mode ? { mode: action.mode as never } : {}),
      ...(action.estimateScale ? { estimateScale: action.estimateScale as never } : {}),
      ...(action.variant ? { variant: action.variant } : {}),
      ...(action.plan ? { plan: action.plan } : {}),
    },
  } satisfies PaletteSearchItem;
}

// Every tile that is NOT a shape: Text and the Sticky note. They are keyed on the tile id and run through the tile's
// own handler (tileHandler), which is what keeps a search add identical to clicking the tile.
const OTHER_TILES = PALETTE_TILES.filter((t) => t.action.type !== 'shape');

// Every non-shape tile, as a search item.
function otherTileItems(): PaletteSearchItem[] {
  return OTHER_TILES.map((tile) => ({
    id: `tile:${tile.id}`,
    name: tileDisplayName(tile),
    keywords: tileKeywords(tile),
    add: { type: 'tile' as const, tileId: tile.id },
  }));
}

// Every tile Plan's palette catalogue holds, as "Add to canvas" search items: its shapes, then the rest.
export function buildPaletteSearchItems(): PaletteSearchItem[] {
  return [...SHAPE_TILES.map(shapeTileSearchItem), ...otherTileItems()];
}
