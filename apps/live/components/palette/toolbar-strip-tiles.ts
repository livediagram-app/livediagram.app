import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@/lib/stickers';
import { searchTechIcons } from '@/lib/tech-icons';
import { tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import {
  iconTileDef,
  resolveFavouriteTile,
  stickerTileDef,
  techTileDef,
} from './palette-dynamic-tiles';
import { visibleTiles } from './PaletteTileGrid';

// Which tiles the Toolbar layout's strip shows for a category (spec/148):
// the first STRIP_TILE_LIMIT of it, and whether a More button is needed to
// reach the rest.
//
// Pure so the rule is testable without rendering the strip. The catalogues
// it reads for Icons / Stickers / Technology are async (lib/icon-registry),
// so before they land those categories simply return no tiles and still ask
// for More, which is where their loading note lives.

export const STRIP_TILE_LIMIT = 10;

// Categories whose body carries more than tiles: a search box, a group
// browser, or Favourites' Edit / Reorder footer. They always get More, even
// when the tiles alone would fit, because the rest of the body can only be
// reached through it.
const ALWAYS_MORE = new Set(['favourites', 'icons', 'stickers', 'technology', 'behaviour']);

function allTilesFor(categoryId: string, favouriteIds: readonly string[]): PaletteTileDef[] {
  switch (categoryId) {
    case 'favourites':
      return favouriteIds
        .map(resolveFavouriteTile)
        .filter((t): t is PaletteTileDef => t !== undefined);
    // Catalogue order is a placeholder for "the ones people use" (spec/148).
    // Sliced BEFORE building tile defs so a 180-glyph catalogue doesn't build
    // 180 JSX glyphs to show ten.
    case 'icons':
      return getLineArtIconCatalog()
        .slice(0, STRIP_TILE_LIMIT + 1)
        .map(iconTileDef);
    case 'stickers':
      return searchStickers('')
        .slice(0, STRIP_TILE_LIMIT + 1)
        .map(stickerTileDef);
    case 'technology':
      return searchTechIcons('', 'all')
        .slice(0, STRIP_TILE_LIMIT + 1)
        .map(techTileDef);
    default:
      return tilesForCategory(categoryId);
  }
}

export function stripTilesFor(
  categoryId: string,
  { favouriteIds, hasImage }: { favouriteIds: readonly string[]; hasImage: boolean },
): { tiles: PaletteTileDef[]; hasMore: boolean } {
  const all = visibleTiles(allTilesFor(categoryId, favouriteIds), hasImage);
  return {
    tiles: all.slice(0, STRIP_TILE_LIMIT),
    hasMore: all.length > STRIP_TILE_LIMIT || ALWAYS_MORE.has(categoryId),
  };
}
