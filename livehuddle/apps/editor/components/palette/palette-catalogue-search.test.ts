// The Toolbar strip's Search over Stickers
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type").
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { searchCatalogueTiles } from './palette-catalogue-search';
import type { PaletteTileDef } from './palette-tile-defs';

beforeAll(async () => {
  await ensureIconCatalogs();
});

const ids = (tiles: PaletteTileDef[]) => tiles.map((t) => t.id);
const from = (tiles: PaletteTileDef[], prefix: string) =>
  ids(tiles).filter((id) => id.startsWith(prefix));

describe('searchCatalogueTiles', () => {
  it('lists no Technology mark, matched or already on the tab (livehuddle offers none)', () => {
    expect(from(searchCatalogueTiles({ query: 'database' }), 'tech:')).toEqual([]);
    const onTab = searchCatalogueTiles({
      query: '',
      tabElements: [
        {
          id: 't',
          type: 'shape',
          shape: 'icon',
          iconId: 'aws-s3',
          x: 0,
          y: 0,
          width: 88,
          height: 88,
        },
      ] as never,
    });
    expect(onTab).toEqual([]);
  });

  it('lists no line-art icon, matched or already on the tab (no Icons in livehuddle)', () => {
    const matched = searchCatalogueTiles({ query: 'heart' });
    expect(ids(matched).some((id) => id.startsWith('icon:'))).toBe(false);
    expect(from(matched, 'sticker:').length).toBeGreaterThan(0);
    const onTab = searchCatalogueTiles({
      query: '',
      tabElements: [
        {
          id: 'i',
          type: 'shape',
          shape: 'icon',
          iconId: 'heart',
          x: 0,
          y: 0,
          width: 88,
          height: 88,
        },
      ] as never,
    });
    expect(onTab).toEqual([]);
  });
});

// Before the catalogues load there is nothing to list (useIconCatalogs).
describe('searchCatalogueTiles before the catalogues load', () => {
  it('lists nothing', () => {
    expect(searchCatalogueTiles({ query: 'heart', loaded: false })).toEqual([]);
  });
});
