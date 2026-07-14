import { describe, expect, it } from 'vitest';
import { PALETTE_TILES, TOOL_GROUPS, tilesInSection, tilesInToolGroup } from './palette-tile-defs';

// The shared tile catalogue (spec/78) feeds the category tabs, Favourites
// (which persists tile IDS across sessions), the search panel, and — since
// the Tools tab grew grouped sub-sections (spec/09 "Sub-categories") — the
// TOOL_GROUPS render loop. These invariants pin the contracts those
// surfaces rely on; none of them surface as errors during a normal render
// (an ungrouped tools tile just silently vanishes from the Tools tab).

describe('PALETTE_TILES catalogue', () => {
  it('has unique ids (favourites persist ids; a duplicate would collide in the grid keys and the favourites list)', () => {
    const ids = PALETTE_TILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every tools-section tile carries a toolGroup that exists in TOOL_GROUPS', () => {
    const groupIds = new Set(TOOL_GROUPS.map((g) => g.id));
    for (const tile of tilesInSection('tools')) {
      expect(tile.toolGroup, `${tile.id} must carry a toolGroup`).toBeDefined();
      expect(groupIds.has(tile.toolGroup!), `${tile.id} group "${tile.toolGroup}"`).toBe(true);
    }
  });

  it('no tile outside the tools section carries a toolGroup (the field is Tools-tab metadata)', () => {
    for (const tile of PALETTE_TILES.filter((t) => t.section !== 'tools')) {
      expect(tile.toolGroup, tile.id).toBeUndefined();
    }
  });
});

describe('TOOL_GROUPS', () => {
  it('has unique ids and non-empty labels (each renders as a PaletteSectionLabel heading)', () => {
    const ids = TOOL_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of TOOL_GROUPS) expect(g.label.length, g.id).toBeGreaterThan(0);
  });

  it('every group is non-empty (an empty group would render a heading over nothing)', () => {
    for (const g of TOOL_GROUPS) {
      expect(tilesInToolGroup(g.id).length, g.id).toBeGreaterThan(0);
    }
  });

  it('the groups partition the whole tools section (no tile silently dropped from the Tools tab)', () => {
    const grouped = TOOL_GROUPS.flatMap((g) => tilesInToolGroup(g.id).map((t) => t.id)).sort();
    const all = tilesInSection('tools')
      .map((t) => t.id)
      .sort();
    expect(grouped).toEqual(all);
  });
});
