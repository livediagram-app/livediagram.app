// What the Toolbar layout's strip shows per category (spec/148).

import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tilesForCategory } from './palette-tile-defs';
import { STRIP_TILE_LIMIT, stripTilesFor } from './toolbar-strip-tiles';

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
