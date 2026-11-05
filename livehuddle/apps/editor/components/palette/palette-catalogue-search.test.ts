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
    const workshop = searchCatalogueTiles({ query: 'database', mode: 'workshop' });
    expect(from([...workshop.here, ...workshop.elsewhere], 'tech:')).toEqual([]);
    const onTab = searchCatalogueTiles({
      query: '',
      mode: 'workshop',
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
    expect([...onTab.here, ...onTab.elsewhere]).toEqual([]);
  });

  it('lists no line-art icon, matched or already on the tab (no Icons in livehuddle)', () => {
    const matched = searchCatalogueTiles({ query: 'heart', mode: 'workshop' });
    expect(ids([...matched.here, ...matched.elsewhere]).some((id) => id.startsWith('icon:'))).toBe(
      false,
    );
    expect(from(matched.here, 'sticker:').length).toBeGreaterThan(0);
    const onTab = searchCatalogueTiles({
      query: '',
      mode: 'workshop',
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
    expect([...onTab.here, ...onTab.elsewhere]).toEqual([]);
  });
});
