// What the Toolbar layout's strip shows per category (docs/specs/007-editor/toolbar-layout.md).

import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tilesForCategory } from './palette-tile-defs';
import {
  STRIP_TILE_LIMIT,
  desktopStripTileLimit,
  fitStripTiles,
  stripCrowdsCorners,
  phoneStripTileLimit,
  stripTilesFor,
} from './toolbar-strip-tiles';

const NONE = { favouriteIds: [], hasImage: true };

describe('stripTilesFor', () => {
  it('never shows more than the limit', () => {
    for (const c of PALETTE_CATEGORIES) {
      expect(stripTilesFor(c.id, NONE).tiles.length, c.id).toBeLessThanOrEqual(STRIP_TILE_LIMIT);
    }
  });

  it('offers More whenever a fixed category has tiles past the limit', () => {
    for (const c of PALETTE_CATEGORIES) {
      if (tilesForCategory(c.id).length > STRIP_TILE_LIMIT) {
        expect(stripTilesFor(c.id, NONE).hasMore, c.id).toBe(true);
      }
    }
  });

  it('always offers More for the categories whose body is more than tiles', () => {
    // Favourites (search + edit), the three searchable catalogues, and the
    // Behaviours group browser can only be fully reached through More.
    for (const id of ['favourites', 'icons', 'stickers', 'technology', 'behaviour']) {
      expect(stripTilesFor(id, NONE).hasMore, id).toBe(true);
    }
  });

  it('shows a short category whole, with no More', () => {
    const devices = tilesForCategory('devices');
    expect(devices.length).toBeLessThanOrEqual(STRIP_TILE_LIMIT);
    const strip = stripTilesFor('devices', NONE);
    expect(strip.tiles.map((t) => t.id)).toEqual(devices.map((t) => t.id));
    expect(strip.hasMore).toBe(false);
  });

  it('shows the saved favourites in their saved order', () => {
    const [a, b] = tilesForCategory('shapes');
    const strip = stripTilesFor('favourites', { favouriteIds: [b!.id, a!.id], hasImage: true });
    expect(strip.tiles.map((t) => t.id)).toEqual([b!.id, a!.id]);
  });

  // docs/specs/007-editor/toolbar-layout.md: using a tile never reorders the strip.
  it('keeps the category\u2019s own order, the first tiles on the strip and the rest behind More', () => {
    const own = tilesForCategory('behaviour').map((t) => t.id);
    const strip = stripTilesFor('behaviour', NONE);
    expect(strip.hasMore).toBe(true);
    expect(strip.tiles.map((t) => t.id)).toEqual(own.slice(0, strip.tiles.length));
  });

  // "Fixed dividers": each category's groups, between the tiles shown.
  it.each([
    ['shapes', ['shapes:diamond', 'shapes:stadium']],
    ['write', ['tools:text']],
    ['draw', ['tools:highlighter', 'tools:polygon']],
    ['build', ['tools:table']],
    ['components', ['tools:entity']],
    ['devices', ['devices:laptop']],
    ['media', ['tools:image', 'media:embed-website']],
    ['data', ['data:legend']],
    ['behaviour', ['tools:mode-isometric']],
  ])('divides %s into its groups', (category, after) => {
    expect([...stripTilesFor(category, NONE).dividersAfter]).toEqual(after);
  });

  it('gives a divided category one tile less when it overflows, to make room', () => {
    const shapes = stripTilesFor('shapes', NONE);
    expect(shapes.hasMore).toBe(true);
    expect(shapes.tiles).toHaveLength(STRIP_TILE_LIMIT - 1);
  });

  it('drops the dividers before any tile when only the tiles fit', () => {
    const count = tilesForCategory('devices').length;
    const tight = stripTilesFor('devices', { ...NONE, limit: count });
    expect(tight.tiles).toHaveLength(count);
    expect(tight.hasMore).toBe(false);
    expect(tight.dividersAfter.size).toBe(0);
  });

  it('gives no category more than two dividers', () => {
    for (const c of PALETTE_CATEGORIES) {
      expect(tilesForCategory(c.id).filter((t) => t.dividerAfter).length, c.id).toBeLessThanOrEqual(
        2,
      );
    }
  });

  it('drops image tiles when uploads are unavailable', () => {
    for (const c of PALETTE_CATEGORIES) {
      const strip = stripTilesFor(c.id, { favouriteIds: [], hasImage: false });
      expect(
        strip.tiles.some((t) => t.needsImage),
        c.id,
      ).toBe(false);
    }
  });
});

describe('phoneStripTileLimit', () => {
  it('fits the strip to the phone', () => {
    expect(phoneStripTileLimit(390)).toBe(3);
    expect(phoneStripTileLimit(430)).toBe(4);
  });

  it('never drops below three tiles, even on a very narrow screen', () => {
    expect(phoneStripTileLimit(320)).toBe(3);
  });

  it('caps at the desktop limit however wide it gets', () => {
    expect(phoneStripTileLimit(2000)).toBe(STRIP_TILE_LIMIT);
  });

  it('shows no more tiles than fit', () => {
    // The strip's measured overhead at 390px (menu button, pickers, More,
    // dividers, padding) was 220px, tiles ~38px: the count must fit 390 - 24.
    expect(220 + phoneStripTileLimit(390) * 38).toBeLessThanOrEqual(390 - 24);
  });
});

describe('desktopStripTileLimit', () => {
  it('shows the full twelve on an ordinary desktop window', () => {
    expect(desktopStripTileLimit(1024)).toBe(STRIP_TILE_LIMIT);
    expect(desktopStripTileLimit(1440)).toBe(STRIP_TILE_LIMIT);
  });

  it('sheds tiles on a narrow window so the centred strip clears the menu button', () => {
    // Menu button clearance (66px) on both sides, 280px of strip chrome, ~38px tiles.
    for (const width of [640, 700, 800]) {
      const tiles = desktopStripTileLimit(width);
      expect(tiles).toBeLessThan(STRIP_TILE_LIMIT);
      expect(280 + tiles * 38).toBeLessThanOrEqual(width - 2 * 66);
    }
  });
});

describe('fitStripTiles (measured)', () => {
  it("fits the room left after the strip's own chrome, capped at twelve", () => {
    expect(fitStripTiles({ available: 1000, chrome: 250, pitch: 40 })).toBe(12);
    expect(fitStripTiles({ available: 560, chrome: 250, pitch: 40 })).toBe(7);
  });

  it('follows a wider chrome (a longer category name) instead of assuming one', () => {
    const narrow = fitStripTiles({ available: 700, chrome: 240, pitch: 38 });
    const wide = fitStripTiles({ available: 700, chrome: 320, pitch: 38 });
    expect(wide).toBeLessThan(narrow);
  });

  it('never drops below three, even with no pitch measured', () => {
    expect(fitStripTiles({ available: 100, chrome: 300, pitch: 38 })).toBe(3);
    expect(fitStripTiles({ available: 900, chrome: 200, pitch: 0 })).toBe(3);
  });
});

describe('stripCrowdsCorners', () => {
  const strip = { left: 300, right: 900 };
  it('is crowded when a corner stack reaches under the strip, with a gap to spare', () => {
    expect(stripCrowdsCorners(strip, [{ left: 890, right: 1180 }])).toBe(true);
    expect(stripCrowdsCorners(strip, [{ left: 905, right: 1180 }])).toBe(true);
    expect(stripCrowdsCorners(strip, [{ left: 910, right: 1180 }])).toBe(false);
  });

  it('ignores an empty corner', () => {
    expect(stripCrowdsCorners(strip, [{ left: 800, right: 800 }])).toBe(false);
  });
});
