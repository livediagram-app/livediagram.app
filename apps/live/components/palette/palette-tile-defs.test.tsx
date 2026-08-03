import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  PALETTE_TILES,
  TOOL_GROUPS,
  tilesForCategory,
  tilesInSection,
  tilesInToolGroup,
} from './palette-tile-defs';

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

describe('tool blurbs', () => {
  // Most categories render a row per tile with a one-line explanation under
  // the name (see PaletteToolRows) — every one whose glyph cannot say what the
  // thing does. A tile without a blurb leaves a bare row, so this is the same
  // kind of registration rule the help centre has. Only Shapes, Icons and
  // Technology are exempt: there the picture IS the explanation.
  const toolTiles = [
    ...tilesInSection('tools'),
    ...tilesInSection('data'),
    ...tilesInSection('components'),
    ...tilesInSection('media'),
    ...tilesInSection('devices'),
  ];

  it('gives every row-rendered tile a blurb', () => {
    const missing = toolTiles.filter((t) => !t.blurb?.trim()).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('keeps each blurb short enough for a palette-width row', () => {
    // Roughly two lines at the rendered size. Past that it stops being a
    // caption and starts being the tooltip, which already exists.
    const tooLong = toolTiles.filter((t) => (t.blurb ?? '').length > 60).map((t) => t.id);
    expect(tooLong).toEqual([]);
  });

  it('does not just repeat the tile caption', () => {
    const echoes = toolTiles
      .filter((t) => t.blurb?.trim().toLowerCase() === (t.caption ?? '').trim().toLowerCase())
      .map((t) => t.id);
    expect(echoes).toEqual([]);
  });
});

// Each browsable category carries a `description` that users read in the
// category picker, and several of those blurbs list the elements the category
// holds. Adding a tile does not update the blurb, and nothing failed when it
// went stale: Behaviour named five of its eight elements for three releases,
// and Collaborate dropped the comment pin (spec/136) the day it shipped.
//
// Text cannot be checked mechanically here — some blurbs enumerate ("estimate
// cards, temperature checks, ...") while others are deliberately illustrative
// ("Square, circle, diamond, and the flowchart shape vocabulary"), and no rule
// separates them. So this pins the COUNT instead. Adding or removing a tile
// fails this test, and the failure is the prompt to re-read that category's
// description and decide whether it still describes what is in the tab.
//
// Categories filled from a catalogue rather than from tiles (Favourites,
// Icons, Stickers, Technology) hold none, and are pinned at 0 so that stays
// true by intent rather than by accident.
const TILES_PER_CATEGORY: Record<string, number> = {
  favourites: 0,
  shapes: 13,
  build: 5,
  write: 4,
  draw: 5,
  devices: 6,
  icons: 0,
  stickers: 0,
  technology: 0,
  media: 8,
  components: 10,
  data: 6,
  // Every Behaviour tile now sits in a group (spec/103, /105, /135): Selection
  // Mode (8 modes), Run the room (3), Get around (2), Session (3),
  // Reactions (5).
  behaviour: 21,
  // The comment panel, loose, plus Ask the room (3 estimate scales +
  // temperature + idea box) and Keep a record (3).
  collaborate: 9,
};

describe('PALETTE_CATEGORIES', () => {
  it('covers every category, so a new one cannot skip the count below', () => {
    expect(PALETTE_CATEGORIES.map((c) => c.id).sort()).toEqual(
      Object.keys(TILES_PER_CATEGORY).sort(),
    );
  });

  it('holds the pinned number of tiles (a change here means re-reading the blurb)', () => {
    for (const category of PALETTE_CATEGORIES) {
      expect(
        tilesForCategory(category.id).length,
        `${category.label}: tile count changed. Three places name this category's elements and all ` +
          `three have gone stale before: PALETTE_CATEGORIES.description here, the help-registry ` +
          `entry, and the article's own helpMetadata description in apps/help. Check all three.`,
      ).toBe(TILES_PER_CATEGORY[category.id]);
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
