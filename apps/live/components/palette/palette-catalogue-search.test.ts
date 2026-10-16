// The Toolbar strip's Search over Icons, Stickers and Technology
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type").
import { beforeAll, describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
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
  it("finds icons and technology marks in Diagram's own section", () => {
    const { here, elsewhere } = searchCatalogueTiles({ query: 'database', mode: 'diagram' });
    expect(from(here, 'icon:').length).toBeGreaterThan(0);
    expect(from(here, 'tech:').length).toBeGreaterThan(0);
    // Stickers are Facilitate's (docs/specs/012-collaboration/facilitate-mode.md), so only they sit elsewhere.
    expect(elsewhere.filter((t) => !t.id.startsWith('sticker:'))).toEqual([]);
  });

  it("still finds stickers from Diagram, in the other modes' section", () => {
    const sticker = getStickerCatalog()[0]!;
    const diagram = searchCatalogueTiles({ query: sticker.label, mode: 'diagram' });
    expect(from(diagram.here, 'sticker:')).toEqual([]);
    expect(ids(diagram.elsewhere)).toContain(`sticker:${sticker.id}`);
    const facilitate = searchCatalogueTiles({ query: sticker.label, mode: 'facilitate' });
    expect(ids(facilitate.here)).toContain(`sticker:${sticker.id}`);
  });

  it("puts a catalogue the mode does not offer in the other modes' section", () => {
    // Illustrate offers Icons and Stickers but not Technology; Plan offers none of them.
    const illustrate = searchCatalogueTiles({ query: 'database', mode: 'illustrate' });
    expect(from(illustrate.here, 'tech:')).toEqual([]);
    expect(from(illustrate.elsewhere, 'tech:').length).toBeGreaterThan(0);
    const plan = searchCatalogueTiles({ query: 'database', mode: 'plan' });
    expect(plan.here).toEqual([]);
  });

  it('caps each catalogue, best match first', () => {
    const { here } = searchCatalogueTiles({ query: 'e', mode: 'diagram' });
    for (const prefix of ['icon:', 'tech:', 'sticker:']) {
      expect(from(here, prefix).length).toBeLessThanOrEqual(CATALOGUE_MATCH_LIMIT);
    }
    const first = getLineArtIconCatalog()[0]!;
    // An exact name ranks first.
    expect(ids(searchCatalogueTiles({ query: first.label, mode: 'diagram' }).here)[0]).toBe(
      `icon:${first.id}`,
    );
  });

  it('lists the entries on the tab before anything is typed', () => {
    const icon = getLineArtIconCatalog()[0]!;
    const sticker = getStickerCatalog()[0]!;
    const { here, elsewhere } = searchCatalogueTiles({
      query: '',
      mode: 'diagram',
      tabElements: [
        el({ shape: 'icon', iconId: icon.id }),
        el({ shape: 'icon', iconId: 'aws-s3' }),
        el({ shape: 'sticker', stickerId: sticker.id }),
        el({ shape: 'square' }),
      ],
    });
    expect(ids(here).sort()).toEqual([`icon:${icon.id}`, 'tech:aws-s3'].sort());
    expect(ids(elsewhere)).toEqual([`sticker:${sticker.id}`]);
  });

  it('lists nothing before typing on a tab with no catalogue entries', () => {
    expect(searchCatalogueTiles({ query: ' ', mode: 'diagram' })).toEqual({
      here: [],
      elsewhere: [],
    });
  });

  it('searches every catalogue well inside a keystroke budget', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) searchCatalogueTiles({ query: 'e', mode: 'diagram' });
    // A query matching most of every catalogue; a keystroke runs one.
    expect((performance.now() - start) / 20).toBeLessThan(16);
  });
});
