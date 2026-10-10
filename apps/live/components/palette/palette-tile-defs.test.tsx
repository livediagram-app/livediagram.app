import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { headlineCase } from '@livediagram/api-schema';
import { EVENT_STORMING_NOTES } from '@livediagram/document';
import { PALETTE_CATEGORIES } from './palette-categories';
import { CARD_TILE_GLYPH_PX } from './palette-plan-tiles';
import {
  PALETTE_TILES,
  TILE_GLYPH_PX,
  TOOL_GROUPS,
  COLLABORATE_CATEGORY_GROUPS,
  tilesForCategory,
  tilesInSection,
  tilesInToolGroup,
} from './palette-tile-defs';

// The shared tile catalogue feeds the category tabs, the palette layouts
// (which address tiles by id), the search panel, and — since
// the Tools tab grew grouped sub-sections (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories") — the
// TOOL_GROUPS render loop. These invariants pin the contracts those
// surfaces rely on; none of them surface as errors during a normal render
// (an ungrouped tools tile just silently vanishes from the Tools tab).

describe('PALETTE_TILES catalogue', () => {
  it('has unique ids (layouts address tiles by id; a duplicate would collide in the grid keys and the layouts)', () => {
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

// The Event Storming category (docs/specs/021-event-storming/event-storming.md): one tile per note kind in the
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
      expect(tile.label, note.kind).toBe(`Add ${headlineCase(note.label)} Note`);
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
    // caption and starts being the hover card, which already exists.
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
// and Collaborate dropped the comment pin (docs/specs/012-collaboration/comment-pin.md) the day it shipped.
//
// Text cannot be checked mechanically here — some blurbs enumerate ("estimate
// cards, temperature checks, ...") while others are deliberately illustrative
// ("Square, circle, diamond, and the flowchart shape vocabulary"), and no rule
// separates them. So this pins the COUNT instead. Adding or removing a tile
// fails this test, and the failure is the prompt to re-read that category's
// description and decide whether it still describes what is in the tab.
//
// Categories filled from a catalogue or a layout rather than from tiles (Popular,
// Icons, Stickers, Technology, My shapes) hold none, and are pinned at 0 so that stays
// true by intent rather than by accident.
const TILES_PER_CATEGORY: Record<string, number> = {
  // Popular has no tiles of its own: each mode's layout fills it (palette-layouts).
  popular: 0,
  shapes: 13,
  build: 5,
  write: 4,
  draw: 6,
  // The Pen alone: the layout adds the Pencil and each person's markers (palette-layouts, PaletteLogoTab).
  logo: 1,
  devices: 7,
  icons: 0,
  stickers: 0,
  technology: 0,
  'my-shapes': 0,
  media: 8,
  components: 9,
  data: 7,
  // The Collaborate elements, one category per group (docs/specs/012-collaboration/facilitate-mode.md
  // "The palette"): 34 tiles between them.
  'collab-ask': 7,
  'collab-tools': 5,
  'collab-record': 5,
  'collab-react': 5,
  'collab-mode': 8,
  'collab-navigate': 4,
  // The Event Storming notation (docs/specs/021-event-storming/event-storming.md): one tile per note kind.
  'event-storming': 8,
  // Plan mode's Boards and Cards (docs/specs/026-plan/plan-mode.md "The palette"): nine boards, one
  // card per item type.
  'plan-boards': 10,
  'plan-cards': 5,
  // A board header's widgets (docs/specs/026-plan/board-widgets.md): one tile per widget kind.
  'plan-widgets': 14,
  // Plan views (docs/specs/026-plan/plan-views.md): ten metrics, five visualisations.
  'plan-metrics': 10,
  'plan-visualisations': 5,
  'plan-sheets': 1,
  // Borrowed tiles, listed by the Plan layout (palette-layouts.ts), so no tile of their own.
  'plan-content': 0,
  'plan-tools': 0,
  // A Participant's category borrows the landing category's sticky and text tiles (participantTiles).
  participate: 0,
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

// The Collaborate elements are six categories, one per `tileGroup` of the Behaviour tool group
// (COLLABORATE_CATEGORY_GROUPS). A tile whose group maps to no category would stay in the catalogue
// and in search but be absent from every palette, with nothing to notice, so the six must partition
// the tool group exactly.
describe('the Collaborate categories', () => {
  const ids = Object.keys(COLLABORATE_CATEGORY_GROUPS);

  it('partition the Behaviour tool group: every tile in exactly one', () => {
    const placed = ids.flatMap((id) => tilesForCategory(id).map((t) => t.id)).sort();
    expect(placed).toEqual(
      tilesInToolGroup('behaviour')
        .map((t) => t.id)
        .sort(),
    );
  });

  it('are each a catalogue category with tiles in it', () => {
    const catalogue = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    for (const id of ids) {
      expect(catalogue.has(id), id).toBe(true);
      expect(tilesForCategory(id).length, id).toBeGreaterThan(0);
    }
  });
});

// One tile strip, one size step (docs/specs/004-interface-design/iconography.md): every tile glyph
// that renders through Glyph does so at TILE_GLYPH_PX, so a strip of tiles reads as one set.
describe('palette tile glyph size', () => {
  const glyphTiles = PALETTE_TILES.map(
    (t) => [t.id, renderToStaticMarkup(<>{t.icon}</>)] as const,
  ).filter(([, svg]) => svg.includes('lvd-glyph'));

  // Plan card tiles are the one larger step: a card picture with its type's glyph on the face.
  it.each(glyphTiles)('%s renders at the tile step', (id, svg) => {
    expect(Number(/width="([\d.]+)"/.exec(svg)![1])).toBe(
      id.startsWith('plan:card-') ? CARD_TILE_GLYPH_PX : TILE_GLYPH_PX,
    );
  });
});

// docs/specs/012-collaboration/session-button.md: the Timer and Stopwatch tiles sit side by side and must not
// wear the same glyph.
describe('session clock tiles', () => {
  it('draw the timer and the stopwatch differently', () => {
    const glyph = (id: string) =>
      renderToStaticMarkup(<>{PALETTE_TILES.find((t) => t.id === id)!.icon}</>);
    expect(glyph('tools:session-timer')).not.toBe(glyph('tools:session-stopwatch'));
  });
});
