import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import { PALETTE_CATEGORIES } from './palette-categories';
import { BEHAVIOUR_GROUPS } from './palette-create-tabs';
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

// The Event Storming category (spec/139): one tile per note kind in the
// EVENT_STORMING_NOTES catalogue, a top-level palette category of its own.
// The tiles derive from the catalogue, so this pins the derivation both
// ways: every note kind has a tile, every tile arms a sticky intent
// carrying that kind's canonical fill AND its kind (the commit path routes
// the note onto its stage's layer on event-storming boards).
describe('event-storming tiles', () => {
  const tiles = tilesForCategory('event-storming');

  it('offers one tile per note kind, in catalogue (workshop) order', () => {
    expect(tiles.map((t) => t.id)).toEqual(EVENT_STORMING_NOTES.map((n) => `tools:es-${n.kind}`));
  });

  it('every tile arms a sticky intent with its kind + canonical fill', () => {
    for (const note of EVENT_STORMING_NOTES) {
      const tile = tiles.find((t) => t.id === `tools:es-${note.kind}`)!;
      expect(tile.action, note.kind).toEqual({
        type: 'sticky',
        fill: note.fill,
        esKind: note.kind,
      });
      expect(tile.label, note.kind).toContain(note.label);
    }
  });

  it('is its own section — no toolGroup, no tileGroup (a top-level category)', () => {
    for (const tile of tiles) {
      expect(tile.section, tile.id).toBe('event-storming');
      expect(tile.toolGroup, tile.id).toBeUndefined();
      expect(tile.tileGroup, tile.id).toBeUndefined();
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
  draw: 4,
  devices: 6,
  icons: 0,
  stickers: 0,
  technology: 0,
  media: 8,
  components: 9,
  data: 6,
  // Behaviours absorbed Collaborate (spec/110), so this is both families:
  // Ask (3 estimate scales + temperature + idea box), Run the
  // room (3), Session (3), Record (3), Reactions (5), Selection
  // Mode (8 modes), Navigate (2), plus the comment pin loose on top.
  behaviour: 32,
  // The Event Storming notation (spec/139): one tile per note kind.
  'event-storming': 8,
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
  it('has unique ids and non-empty labels (each renders as a group title)', () => {
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

// Behaviour and Collaborate draw their tiles by CATEGORY (spec/09
// "Sub-categories"): each tab hands PaletteGroupBrowser a list of group
// definitions, and a tile is drawn by the category whose id matches its
// `tileGroup`. A tile whose group is in no definition is drawn by nothing: it
// stays in the catalogue, keeps working in search and in Favourites, and is
// simply absent from the palette tab it belongs to. No error, no empty
// category, nothing to notice — the browser drops a category with no tiles, so
// a typo'd group id fails silently at both ends.
//
// The Tools tab has had `TOOL_GROUPS` and a partition test since it grew
// sub-sections; these two kept their groups inside the JSX until they became
// category browsers, so there was nothing to assert against.
//
// The definitions are read through the SAME constant the render passes — the
// source is scraped only for WHICH constant that is, so renaming or swapping
// the array cannot leave this test checking a list nobody renders. A list
// typed into this file would agree with itself and prove nothing, which is the
// failure mode SHAPE_KEYWORDS and the palette census both hit.
const GROUP_CONSTANTS: Record<string, { id: string }[]> = {
  BEHAVIOUR_GROUPS,
};

function renderedGroups(component: string): { groups: Set<string>; allowsLoose: boolean } {
  const src = readFileSync(new URL('./palette-create-tabs.tsx', import.meta.url), 'utf8');
  const start = src.indexOf(`export function ${component}`);
  // Bound to THIS component: a fixed-length slice ran past the Collaborate tab
  // into the next one and collected its filters as if they were Collaborate's.
  const after = src.indexOf('\nexport function ', start + 1);
  const body = src.slice(start, after === -1 ? undefined : after);
  const constName = body.match(/groups=\{([A-Z_]+)\}/)?.[1] ?? '';
  const defs = GROUP_CONSTANTS[constName] ?? [];
  return {
    groups: new Set(defs.map((g) => g.id)),
    // The ungrouped tiles are drawn above the category grid, or not at all.
    allowsLoose: /leadIn=\{/.test(body),
  };
}

// Behaviours is a toolGroup INSIDE the tools section, not a section of its
// own: asking for a 'behaviour' section returns nothing and would make every
// row look empty. It is the only grouped tab left — Collaborate was merged
// into it (spec/110) — and the list stays an array so a second one costs a
// line rather than a rewrite.
const TABS = [
  {
    name: 'behaviour',
    component: 'PaletteBehaviourTab',
    tiles: () => tilesInToolGroup('behaviour'),
  },
] as const;

describe('grouped palette tabs draw every tile they hold', () => {
  for (const tab of TABS) {
    it(`${tab.name}: every tile lands in a row that exists`, () => {
      const { groups, allowsLoose } = renderedGroups(tab.component);
      // Guard against the source read silently finding nothing.
      expect(groups.size, `${tab.name}: no tileGroup filters found`).toBeGreaterThan(1);

      const undrawn = tab
        .tiles()
        .filter((t) => (t.tileGroup ? !groups.has(t.tileGroup) : !allowsLoose))
        .map((t) => `${t.id} (${t.tileGroup ?? 'no group'})`);
      expect(undrawn).toEqual([]);
    });

    it(`${tab.name}: every row it draws has tiles in it`, () => {
      // The mirror: a filter for a group nothing carries renders a heading
      // over an empty list.
      const { groups } = renderedGroups(tab.component);
      const tiles = tab.tiles();
      const empty = [...groups].filter((g) => !tiles.some((t) => t.tileGroup === g));
      expect(empty).toEqual([]);
    });
  }
});
