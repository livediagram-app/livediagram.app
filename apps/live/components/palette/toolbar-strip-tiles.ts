import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@/lib/stickers';
import { searchTechIcons } from '@/lib/tech-icons';
import { orderByRecent } from '@/lib/toolbar-recent-tiles';
import { tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import {
  iconTileDef,
  resolveFavouriteTile,
  stickerTileDef,
  techTileDef,
} from './palette-dynamic-tiles';
import { visibleTiles } from './PaletteTileGrid';

// Which tiles the Toolbar layout's strip shows for a category (docs/specs/007-editor/toolbar-layout.md):
// the first STRIP_TILE_LIMIT of it, and whether a More button is needed to
// reach the rest. "First" is by use: recently-used tiles lead, most recent
// first, and the rest follow in the category's own order.
//
// Pure so the rule is testable without rendering the strip. The catalogues
// it reads for Icons / Stickers / Technology are async (lib/icon-registry),
// so before they land those categories simply return no tiles and still ask
// for More, which is where their loading note lives.

export const STRIP_TILE_LIMIT = 12;
const STRIP_TILE_PX = 38;
const MIN_STRIP_TILES = 3;
// A phone's strip fits as many tiles as its width allows once the side
// gutters, the Explorer menu button, the icon-only selection mode + category
// picker, More, the dividers and the card's padding are paid for: three on a
// 390px phone, four from about 410px.
const PHONE_GUTTERS_PX = 24;
const PHONE_STRIP_CHROME_PX = 220;
// A desktop strip is centred, so it has to clear the Explorer menu button
// (top-left, 12px in, 46px wide, plus an 8px gap) on BOTH sides. Its own
// chrome is wider than a phone's because the category picker shows its name:
// measured at 239px with "Favourites", padded for a longer name like
// "Event Storming". Twelve tiles fit from about 870px; a narrower window
// sheds tiles to More rather than running the strip under the menu button.
const DESKTOP_MENU_CLEARANCE_PX = 66;
const DESKTOP_STRIP_CHROME_PX = 280;

function fitTiles(roomPx: number, pitch = STRIP_TILE_PX): number {
  return Math.min(STRIP_TILE_LIMIT, Math.max(MIN_STRIP_TILES, Math.floor(roomPx / pitch)));
}

export function phoneStripTileLimit(viewportWidth: number): number {
  return fitTiles(viewportWidth - PHONE_GUTTERS_PX - PHONE_STRIP_CHROME_PX);
}

export function desktopStripTileLimit(viewportWidth: number): number {
  return fitTiles(viewportWidth - 2 * DESKTOP_MENU_CLEARANCE_PX - DESKTOP_STRIP_CHROME_PX);
}

// The strip's tile count from MEASURED sizes (useStripTileLimit): the room
// the strip may take, less its own chrome (pickers, More, dividers, padding),
// over one tile's pitch. The two *StripTileLimit functions above are the same
// rule over estimated sizes, used only before the first measurement.
export function fitStripTiles({
  available,
  chrome,
  pitch,
}: {
  available: number;
  chrome: number;
  pitch: number;
}): number {
  if (!(pitch > 0)) return MIN_STRIP_TILES;
  return fitTiles(available - chrome, pitch);
}

// Whether the strip reaches into a top-corner panel stack, horizontally, with
// `gap` to spare. An empty corner (zero width) never counts. The canvas chrome
// then starts its top corner stacks below the strip (docs/specs/007-editor/toolbar-layout.md).
export type Span = { left: number; right: number };
export function stripCrowdsCorners(strip: Span, corners: Span[], gap = 8): boolean {
  return corners.some(
    (c) => c.right - c.left > 0 && strip.left < c.right + gap && strip.right > c.left - gap,
  );
}

// Categories whose body carries more than tiles: a search box, a group
// browser, or Favourites' Edit / Reorder footer. They always get More, even
// when the tiles alone would fit, because the rest of the body can only be
// reached through it.
const ALWAYS_MORE = new Set(['favourites', 'icons', 'stickers', 'technology', 'behaviour']);

// The id prefix each searchable catalogue's tiles carry (palette-dynamic-tiles).
const CATALOGUE_PREFIX: Record<string, string> = {
  icons: 'icon:',
  stickers: 'sticker:',
  technology: 'tech:',
};

// A catalogue category's recently-used tiles. The catalogue itself is sliced
// to the strip's length before tiles are built, so a used glyph from further
// down would never be in the slice to be promoted: it is resolved by id
// instead and put in front of it.
function recentCatalogueTiles(categoryId: string, recent: readonly string[]): PaletteTileDef[] {
  const prefix = CATALOGUE_PREFIX[categoryId];
  if (!prefix) return [];
  return recent
    .filter((id) => id.startsWith(prefix))
    .map(resolveFavouriteTile)
    .filter((t): t is PaletteTileDef => t !== undefined);
}

function allTilesFor(categoryId: string, favouriteIds: readonly string[]): PaletteTileDef[] {
  switch (categoryId) {
    case 'favourites':
      return favouriteIds
        .map(resolveFavouriteTile)
        .filter((t): t is PaletteTileDef => t !== undefined);
    // Catalogue order is a placeholder for "the ones people use" (docs/specs/007-editor/toolbar-layout.md).
    // Sliced BEFORE building tile defs so a 180-glyph catalogue doesn't build
    // 180 JSX glyphs to show twelve.
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
  {
    favouriteIds,
    hasImage,
    limit = STRIP_TILE_LIMIT,
    recent = [],
  }: {
    favouriteIds: readonly string[];
    hasImage: boolean;
    limit?: number;
    recent?: readonly string[];
  },
): { tiles: PaletteTileDef[]; hasMore: boolean } {
  const base = allTilesFor(categoryId, favouriteIds);
  const extra = recentCatalogueTiles(categoryId, recent).filter(
    (t) => !base.some((b) => b.id === t.id),
  );
  const all = orderByRecent(visibleTiles([...extra, ...base], hasImage), recent);
  return {
    tiles: all.slice(0, limit),
    hasMore: all.length > limit || ALWAYS_MORE.has(categoryId),
  };
}
