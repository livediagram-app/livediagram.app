// The Toolbar strip's Search over Icons, Stickers and Technology
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
  it("puts a catalogue the mode does not offer in the other modes' section", () => {
    // Workshop offers Icons and Stickers but not Technology.
    const workshop = searchCatalogueTiles({ query: 'database', mode: 'workshop' });
    expect(from(workshop.here, 'tech:')).toEqual([]);
    expect(from(workshop.elsewhere, 'tech:').length).toBeGreaterThan(0);
  });
});
