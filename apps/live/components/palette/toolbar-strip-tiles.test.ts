// What the Toolbar layout's strip shows per category (docs/specs/007-editor/toolbar-layout.md).

import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tilesForCategory } from './palette-tile-defs';
import {
  STRIP_TILE_LIMIT,
  desktopStripTileLimit,
  stripCrowdsTopCorners,
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

  it('brings a used tile to the front, pushing the last one behind More', () => {
    const favouriteIds = tilesForCategory('shapes')
      .slice(0, STRIP_TILE_LIMIT + 1)
      .map((t) => t.id);
    const used = favouriteIds[STRIP_TILE_LIMIT]!;
    const strip = stripTilesFor('favourites', { favouriteIds, hasImage: true, recent: [used] });
    expect(strip.tiles.map((t) => t.id)).toEqual([used, ...favouriteIds.slice(0, -2)]);
  });

  it('ignores a used tile that is not in the category', () => {
    const shapes = stripTilesFor('shapes', NONE).tiles.map((t) => t.id);
    const strip = stripTilesFor('shapes', { ...NONE, recent: ['tools:session-timer'] });
    expect(strip.tiles.map((t) => t.id)).toEqual(shapes);
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

describe('stripCrowdsTopCorners', () => {
  it('moves the top corners below the strip only when it would reach a docked panel', () => {
    expect(stripCrowdsTopCorners(1100)).toBe(true);
    expect(stripCrowdsTopCorners(1440)).toBe(false);
    expect(stripCrowdsTopCorners(1920)).toBe(false);
  });
});
