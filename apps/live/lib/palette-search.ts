// Assembles the palette catalogue (shapes + line-art icons + technology icons
// + stickers) into the flat, keyword-tagged list the global search surfaces as
// "Add to canvas" results (docs/specs/008-canvas/canvas-and-palette.md). Built here, not in lib/search.ts, so the
// search matcher stays catalogue-agnostic and the Explorer (which never adds
// elements) doesn't pull the icon data into its bundle.

import type { ShapeKind } from '@livediagram/document';

import { tileKeywords } from '@/lib/palette-tile-keywords';
import type { PaletteSearchItem } from '@/lib/search';
import {
  PALETTE_TILES,
  tileDisplayName,
  type PaletteTileDef,
} from '@/components/palette/palette-tile-defs';
import {
  getLoadedIconCatalog,
  getLoadedStickerCatalog,
  getLoadedTechIconCatalog,
} from '@/lib/icon-registry';
import { isLegacyEmojiIconId } from '@livediagram/icons';

// The shape-placing tiles, in palette order. Derived from the shared
// catalogue (palette-tile-defs) rather than restated, which is what keeps search from
// drifting behind the palette again. Icon / sticker / tech tiles are excluded
// deliberately: those catalogues are enumerated in full below, so including
// their single "open the picker" tile would add a duplicate result.
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
  };
  const kind = action.kind;
  // Keyed on the CHOICE where there is one, not just the kind: the five
  // reaction tiles and the three session tiles all place the same shape,
  // so keying on kind alone gave eight results three distinct ids and the
  // panel silently dropped the duplicates.
  const choice =
    action.session ?? action.reaction ?? action.mode ?? action.estimateScale ?? action.plan;
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
      ...(action.plan ? { plan: action.plan } : {}),
    },
  } satisfies PaletteSearchItem;
}

// Every tile that is NOT a shape: Text, Arrow, Sticky note, Table, Image, the
// pens, embeds, web components, event-storming notes. Search used to offer
// shapes only, so none of these could be added from it. They are keyed on
// the tile id and run through the tile's own handler (tileHandler), which is
// what keeps a search add identical to clicking the tile. Dynamic icon /
// sticker / tech tiles are left to the catalogue enumeration below.
const OTHER_TILES = PALETTE_TILES.filter(
  (t) =>
    t.action.type !== 'shape' &&
    t.action.type !== 'icon' &&
    t.action.type !== 'tech-icon' &&
    t.action.type !== 'sticker',
);

// A function, not a module-load constant: the icon catalogues load as an
// async chunk (lib/icon-registry.ts), so the list must be rebuilt once they
// land. The shape entries are always present; icon / tech entries appear as
// soon as the chunk does. The caller (EditorSearchPanel) subscribes via
// useIconCatalogs, so it re-renders — and rebuilds this list — on load; the
// build is a few hundred tiny objects, cheap enough to run per open-panel
// render without memoisation.
// `hasImage` hides the tiles that need image uploads (Image, Avatar, Hero)
// when the editor has none, as the palette's own grids do (visibleTiles).
export function buildPaletteSearchItems({
  hasImage = true,
}: { hasImage?: boolean } = {}): PaletteSearchItem[] {
  return [
    ...SHAPE_TILES.map(shapeTileSearchItem),
    ...OTHER_TILES.filter((t) => !t.needsImage || hasImage).map((tile) => ({
      id: `tile:${tile.id}`,
      name: tileDisplayName(tile),
      keywords: tileKeywords(tile),
      add: { type: 'tile' as const, tileId: tile.id },
    })),
    // Line art only. The catalogue still carries the legacy emoji entries so
    // elements from before docs/specs/010-palette/stickers.md keep rendering, but offering them here would add
    // a second way to place something that is a sticker now.
    ...getLoadedIconCatalog()
      .filter((i) => !isLegacyEmojiIconId(i.id))
      .map((i) => ({
        id: `icon:${i.id}`,
        name: i.label,
        keywords: `icon ${i.keywords}`,
        add: { type: 'icon' as const, iconId: i.id },
      })),
    // Stickers (docs/specs/010-palette/stickers.md), added through their own path. A badge also
    // matches on the word on its pill, so "blocked" finds BLOCKED.
    ...getLoadedStickerCatalog().map((s) => ({
      id: `sticker:${s.id}`,
      name: s.label,
      keywords: `sticker ${s.kind === 'badge' ? `${s.text.toLowerCase()} badge ` : 'emoji '}${s.keywords}`,
      add: { type: 'sticker' as const, stickerId: s.id },
    })),
    ...getLoadedTechIconCatalog().map((t) => ({
      id: `tech:${t.id}`,
      name: t.label,
      keywords: `technology ${t.keywords}`,
      add: { type: 'tech' as const, iconId: t.id },
    })),
  ];
}
