import { getLineArtIconCatalog } from '@/lib/icons';
import { searchStickers } from '@/lib/stickers';
import { searchTechIcons } from '@/lib/tech-icons';
import { tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import { iconTileDef, stickerTileDef, techTileDef } from './palette-dynamic-tiles';
import { visibleTiles } from './PaletteTileGrid';

// Which tiles the Toolbar layout's strip shows for a category (docs/specs/007-editor/toolbar-layout.md):
// the first STRIP_TILE_LIMIT of it, in the category's own order, and whether a More button is
// needed to reach the rest. Using a tile never reorders the strip. A category's fixed dividers
// (a tile's `dividerAfter`) show between the tiles on the strip that they separate.
//
// Pure so the rule is testable without rendering the strip. The catalogues
// it reads for Icons / Stickers / Technology are async (lib/icon-registry),
// so before they land those categories simply return no tiles and still ask
// for More, which is where their loading note lives.

export const STRIP_TILE_LIMIT = 12;
const STRIP_TILE_PX = 38;
// Two, not three: a 360px phone has room for two beside the menu card, and a
// third would run the strip off the screen.
const MIN_STRIP_TILES = 2;
// A phone's strip fits as many tiles as its width allows once the side
// gutters, the menu card beside it (the Explorer menu button and mode switch,
// plus its 8px gap), the icon-only selection mode + category picker, More, the
// dividers and the card's padding are paid for: two on a 360px phone, three on
// a 390px one, four
// from about 410px.
const PHONE_GUTTERS_PX = 24;
const PHONE_STRIP_CHROME_PX = 236;
// A desktop strip is centred, so it has to clear the Explorer menu card
// (top-left, 12px in, 96px wide with the mode switch, plus an 8px gap) on BOTH sides. Its own
// chrome is wider than a phone's because the category picker shows its name:
// measured at 239px with "Favourites" (as long as "Popular"), padded for a longer name like
// "Event Storming". Twelve tiles fit from about 970px; a narrower window
// sheds tiles to More rather than running the strip under the menu button.
const DESKTOP_MENU_CLEARANCE_PX = 116;
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

// The strip's room from MEASURED sizes (useStripTileLimit): the room the
// strip may take, less its own chrome (pickers, More, dividers, padding), over
// one tile's pitch. Kept fractional (in tiles), so stripTilesFor can spend a
// part-tile of slack on a divider instead of giving up a whole tile for it. The two *StripTileLimit functions above are the same
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
  return Math.min(STRIP_TILE_LIMIT, Math.max(MIN_STRIP_TILES, (available - chrome) / pitch));
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

// Categories whose body carries more than tiles: a search box or a group
// browser. They always get More, even
// when the tiles alone would fit, because the rest of the body can only be
// reached through it.
const ALWAYS_MORE = new Set(['icons', 'stickers', 'technology', 'behaviour']);

function allTilesFor(
  categoryId: string,
  tiles: readonly PaletteTileDef[] | null | undefined,
): PaletteTileDef[] {
  switch (categoryId) {
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
      // The mode's layout hands in the category's tiles; the default membership otherwise.
      return tiles ? [...tiles] : tilesForCategory(categoryId);
  }
}

// A divider is about a fifth of a tile wide (a 1px rule with 2px either side,
// against a 32-38px tile pitch). `limit` is the room in tiles, possibly
// fractional (fitStripTiles): a strip shows as many tiles as fit with the
// dividers between them, so a divider costs a tile only when the slack
// can't hold it.
const DIVIDER_TILES = 0.2;
export function stripTilesFor(
  categoryId: string,
  {
    hasImage,
    limit = STRIP_TILE_LIMIT,
    tiles,
  }: {
    hasImage: boolean;
    limit?: number;
    // The category's tiles in the palette's mode (palette-layouts); its default tiles when absent.
    tiles?: readonly PaletteTileDef[] | null;
  },
): { tiles: PaletteTileDef[]; hasMore: boolean; dividersAfter: ReadonlySet<string> } {
  const all = visibleTiles(allTilesFor(categoryId, tiles), hasImage);
  const between = (tiles: PaletteTileDef[]) => tiles.slice(0, -1).filter((t) => t.dividerAfter);
  const cost = (tiles: PaletteTileDef[]) => tiles.length + DIVIDER_TILES * between(tiles).length;
  // The whole category with its dividers, when it all fits.
  if (cost(all) <= limit) {
    return {
      tiles: all,
      hasMore: ALWAYS_MORE.has(categoryId),
      dividersAfter: new Set(between(all).map((t) => t.id)),
    };
  }
  // The whole category without them, when only the tiles fit.
  if (all.length <= limit) {
    return { tiles: all, hasMore: ALWAYS_MORE.has(categoryId), dividersAfter: NO_DIVIDERS };
  }
  // Overflowing: the first tiles with their dividers, a tile fewer only while
  // the dividers don't fit in the slack.
  let count = Math.floor(limit);
  while (count > 1 && cost(all.slice(0, count)) > limit) count -= 1;
  const shown = all.slice(0, count);
  return {
    tiles: shown,
    hasMore: true,
    dividersAfter: new Set(between(shown).map((t) => t.id)),
  };
}

const NO_DIVIDERS: ReadonlySet<string> = new Set();
