// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// the split between Plan's palette's tiles and the rest, and the ranking.
import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';
import type { Element } from '@liveplanner/document';
import {
  elementSignature,
  elementTileSections,
  mergeByName,
  modeElementTiles,
  rankTiles,
  searchElementTiles,
  tileSignature,
} from './palette-tile-search';
import {
  PALETTE_TILES,
  tileById,
  tilesForCategory,
  type PaletteTileDef,
} from './palette-tile-defs';
import { PALETTE_CATEGORIES } from './palette-categories';
import { CATALOGUE_CATEGORIES } from './palette-layouts';
import { planCardTile } from './palette-plan-tiles';
import { markerTiles } from './palette-marker-tiles';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';

const ids = (tiles: PaletteTileDef[]) => tiles.map((t) => t.id);

// Raw elements, only the fields a signature reads.
const el = (e: Record<string, unknown>) =>
  ({ id: 'x', x: 0, y: 0, width: 1, height: 1, ...e }) as unknown as Element;

describe('elementTileSections', () => {
  it("lists every tile of Plan's palette once, in layout order", () => {
    const tiles = modeElementTiles();
    expect(new Set(ids(tiles)).size).toBe(tiles.length);
    // Cards lead, so the first card type comes first.
    expect(tiles[0]?.section).toBe('plan-cards');
    expect(ids(elementTileSections({ hasImage: true }).here)).toEqual(ids(tiles));
  });

  it("puts the tiles Plan's palette does not offer in the other section, never in both", () => {
    const { here, elsewhere } = elementTileSections({ hasImage: true });
    expect(ids(here)).toEqual(
      expect.arrayContaining(['plan:board-kanban', 'plan:view-gantt', 'plan:sheet']),
    );
    expect(ids(elsewhere)).toEqual(
      expect.arrayContaining(['data:pie', 'devices:phone', 'tools:es-domain-event']),
    );
    expect(ids(here)).not.toContain('data:pie');
    const mine = new Set(ids(here));
    expect(elsewhere.filter((t) => mine.has(t.id))).toEqual([]);
  });

  it('covers every tile of every category between its two sections', () => {
    const { here, elsewhere } = elementTileSections({ hasImage: true });
    const all = new Set([...ids(here), ...ids(elsewhere)]);
    for (const c of PALETTE_CATEGORIES) {
      if (CATALOGUE_CATEGORIES.has(c.id)) continue;
      for (const t of tilesForCategory(c.id)) expect(all.has(t.id), `${c.id}: ${t.id}`).toBe(true);
    }
  });

  it('leaves out the image-upload tiles where the editor has none', () => {
    const { here, elsewhere } = elementTileSections({ hasImage: false });
    const needsImage = PALETTE_TILES.filter((t) => t.needsImage).map((t) => t.id);
    expect([...ids(here), ...ids(elsewhere)].filter((id) => needsImage.includes(id))).toEqual([]);
  });

  it("uses the document's own card types, and keeps the built-in ones out of elsewhere", () => {
    const own = [{ ...ITEM_TYPES[0], id: 'custom', label: 'Custom' }];
    const { here, elsewhere } = elementTileSections({
      hasImage: true,
      planCardTiles: own.map(planCardTile),
    });
    expect(ids(here)).toContain('plan:card-custom');
    expect(ids(here)).not.toContain(`plan:card-${ITEM_TYPES[0].id}`);
    expect(elsewhere.filter((t) => t.section === 'plan-cards')).toEqual([]);
  });
});

describe('searchElementTiles', () => {
  it('finds a tile by a synonym', () => {
    const { elsewhere } = searchElementTiles({ query: 'database', hasImage: true });
    expect(ids(elsewhere)).toContain('shapes:cylinder');
  });

  it("finds a tile Plan's palette does not offer in the other section", () => {
    const { here, elsewhere } = searchElementTiles({ query: 'pie', hasImage: true });
    expect(ids(here)).toEqual([]);
    expect(ids(elsewhere)).toEqual(['data:pie']);
  });

  it("finds Plan's own tiles in its own section", () => {
    const { here } = searchElementTiles({ query: 'gantt', hasImage: true });
    expect(ids(here)).toContain('plan:view-gantt');
  });

  it('finds nothing for nonsense, in either section', () => {
    expect(searchElementTiles({ query: 'zzqqxx', hasImage: true })).toEqual({
      here: [],
      elsewhere: [],
    });
  });

  it('lists only the element types on the tab before anything is typed', () => {
    const { here, elsewhere } = searchElementTiles({
      query: '  ',
      hasImage: true,
      tabElements: [
        el({ type: 'shape', shape: 'circle' }),
        el({ type: 'shape', shape: 'circle' }),
        el({ type: 'sticky' }),
        el({ type: 'shape', shape: 'pie-chart' }),
      ],
    });
    // Layout order, each type once.
    expect(ids(here)).toEqual(['tools:sticky']);
    expect(ids(elsewhere)).toEqual(['shapes:circle', 'data:pie']);
  });

  it('lists nothing before typing on an empty tab', () => {
    expect(searchElementTiles({ query: '', hasImage: true })).toEqual({
      here: [],
      elsewhere: [],
    });
  });
});

describe("Draw's markers", () => {
  const drawTiles = markerTiles(DEFAULT_WHITEBOARD_PREFS, 'light');

  it('are found by name, always in the other section', () => {
    const { here, elsewhere } = searchElementTiles({
      query: 'marker',
      hasImage: true,
      drawTiles,
    });
    expect(ids(here)).not.toContain('draw:marker-main');
    expect(ids(elsewhere)).toEqual(
      expect.arrayContaining(['draw:marker-main', 'draw:marker-second', 'draw:marker-third']),
    );
  });

  it('name each pen by its place, and say its colour and width', () => {
    expect(drawTiles.map((t) => t.caption)).toEqual(['Marker 1', 'Marker 2', 'Marker 3']);
    expect(drawTiles[1]!.description).toContain('Blue, Medium');
    expect(drawTiles[1]!.action).toEqual({
      type: 'marker',
      penId: 'second',
      colour: 'blue',
      width: 1.5,
    });
  });

  it('give way to the pencil on the tab, a stroke being a stroke', () => {
    const { here, elsewhere } = searchElementTiles({
      query: '',
      hasImage: true,
      drawTiles,
      tabElements: [el({ type: 'freehand' })],
    });
    expect(ids(here)).toEqual([]);
    expect(ids(elsewhere)).toEqual(['tools:pencil']);
  });
});

describe('tile and element signatures', () => {
  const sigOf = (id: string) => tileSignature(tileById(id)!);

  it('tell apart the choices an element records', () => {
    expect(elementSignature(el({ type: 'sticky', esKind: 'domain-event' }))).toBe(
      sigOf('tools:es-domain-event'),
    );
    expect(elementSignature(el({ type: 'sticky' }))).toBe(sigOf('tools:sticky'));
    expect(elementSignature(el({ type: 'freehand', pen: 'highlighter' }))).not.toBe(
      sigOf('tools:pencil'),
    );
    expect(elementSignature(el({ type: 'arrow', arrowEnds: 'none' }))).toBe(sigOf('tools:line'));
    expect(elementSignature(el({ type: 'arrow' }))).toBe(sigOf('tools:arrow'));
  });

  it('gives the catalogue tiles none', () => {
    const catalogue = PALETTE_TILES.filter(
      (t) =>
        t.action.type === 'icon' || t.action.type === 'tech-icon' || t.action.type === 'sticker',
    );
    for (const t of catalogue) expect(tileSignature(t), t.id).toBeNull();
  });
});

describe('mergeByName', () => {
  const t = (id: string) => tileById(id)!;

  it('puts a name match from a later list above a keyword-only match from an earlier one', () => {
    // "flowchart" is a keyword of the diamond; "Gantt Chart" is the Gantt view's name.
    expect(ids(mergeByName('chart', [t('shapes:diamond')], [t('plan:view-gantt')]))).toEqual([
      'plan:view-gantt',
      'shapes:diamond',
    ]);
  });

  it('keeps list order among equals, and on an empty query', () => {
    const lists = [[t('shapes:square')], [t('shapes:circle')]];
    expect(ids(mergeByName('', ...lists))).toEqual(['shapes:square', 'shapes:circle']);
    expect(ids(mergeByName('zz', ...lists))).toEqual(['shapes:square', 'shapes:circle']);
  });
});

describe('rankTiles', () => {
  const tiles = ['shapes:cylinder', 'shapes:circle', 'shapes:square'].map((id) => tileById(id)!);

  it('ranks a name match above a keyword-only one', () => {
    // "circle" is the circle's name; the cylinder and square do not mention it.
    expect(ids(rankTiles('circle', tiles))[0]).toBe('shapes:circle');
    // "box" is only a keyword of the square.
    expect(ids(rankTiles('box', tiles))).toEqual(['shapes:square']);
  });

  it('keeps input order on an empty or blank query', () => {
    expect(ids(rankTiles('  ', tiles))).toEqual(ids(tiles));
  });

  it('keeps input order between equal ranks', () => {
    // Both names start with "c".
    expect(ids(rankTiles('c', tiles)).slice(0, 2)).toEqual(['shapes:cylinder', 'shapes:circle']);
  });
});

describe('a worst-case query', () => {
  it('ranks every tile well inside a keystroke budget', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++)
      searchElementTiles({ query: 'e', hasImage: true });
    // 50 searches matching most of the catalogue; a keystroke runs one.
    expect((performance.now() - start) / 50).toBeLessThan(16);
  });
});
