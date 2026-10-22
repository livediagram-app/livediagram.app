// The Toolbar strip's Search over Icons, Stickers and Technology
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type").
import { beforeAll, describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/document';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { getLineArtIconCatalog } from '@/lib/icons';
import { getStickerCatalog } from '@/lib/stickers';
import { CATALOGUE_MATCH_LIMIT, searchCatalogueTiles } from './palette-catalogue-search';
import type { PaletteTileDef } from './palette-tile-defs';

beforeAll(async () => {
  await ensureIconCatalogs();
});

const ids = (tiles: PaletteTileDef[]) => tiles.map((t) => t.id);
const from = (tiles: PaletteTileDef[], prefix: string) =>
  ids(tiles).filter((id) => id.startsWith(prefix));
const el = (e: Record<string, unknown>) =>
  ({ id: 'x', x: 0, y: 0, width: 1, height: 1, type: 'shape', ...e }) as unknown as Element;

describe('searchCatalogueTiles', () => {
  // Plan's palette offers none of the catalogues (docs/specs/026-plan/plan-mode.md "The palette"), so every match is
  // in the other section.
  it('finds icons, stickers and technology marks, all in the other section', () => {
    const { here, elsewhere } = searchCatalogueTiles({ query: 'database' });
    expect(here).toEqual([]);
    expect(from(elsewhere, 'icon:').length).toBeGreaterThan(0);
    expect(from(elsewhere, 'tech:').length).toBeGreaterThan(0);
    const sticker = getStickerCatalog()[0]!;
    expect(ids(searchCatalogueTiles({ query: sticker.label }).elsewhere)).toContain(
      `sticker:${sticker.id}`,
    );
  });

  it('caps each catalogue, best match first', () => {
    const { elsewhere } = searchCatalogueTiles({ query: 'e' });
    for (const prefix of ['icon:', 'tech:', 'sticker:']) {
      expect(from(elsewhere, prefix).length).toBeLessThanOrEqual(CATALOGUE_MATCH_LIMIT);
    }
    const first = getLineArtIconCatalog()[0]!;
    // An exact name ranks first.
    expect(ids(searchCatalogueTiles({ query: first.label }).elsewhere)[0]).toBe(`icon:${first.id}`);
  });

  it('lists the entries on the tab before anything is typed', () => {
    const icon = getLineArtIconCatalog()[0]!;
    const sticker = getStickerCatalog()[0]!;
    const { here, elsewhere } = searchCatalogueTiles({
      query: '',
      tabElements: [
        el({ shape: 'icon', iconId: icon.id }),
        el({ shape: 'icon', iconId: 'aws-s3' }),
        el({ shape: 'sticker', stickerId: sticker.id }),
        el({ shape: 'square' }),
      ],
    });
    expect(here).toEqual([]);
    expect(ids(elsewhere).sort()).toEqual(
      [`icon:${icon.id}`, 'tech:aws-s3', `sticker:${sticker.id}`].sort(),
    );
  });

  it('lists nothing before typing on a tab with no catalogue entries', () => {
    expect(searchCatalogueTiles({ query: ' ' })).toEqual({
      here: [],
      elsewhere: [],
    });
  });

  it('searches every catalogue well inside a keystroke budget', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) searchCatalogueTiles({ query: 'e' });
    // A query matching most of every catalogue; a keystroke runs one.
    expect((performance.now() - start) / 20).toBeLessThan(16);
  });

  it('lists nothing until the catalogues have loaded', () => {
    expect(searchCatalogueTiles({ query: 'database', loaded: false })).toEqual({
      here: [],
      elsewhere: [],
    });
  });
});
