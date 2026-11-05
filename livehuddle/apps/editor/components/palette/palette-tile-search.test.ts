// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// the split between this mode's tiles and the others', and the ranking.
import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import {
  elementSignature,
  elementTileSections,
  mergeByName,
  rankTiles,
  tileSignature,
} from './palette-tile-search';
import { PALETTE_TILES, tileById, type PaletteTileDef } from './palette-tile-defs';
import { markerTiles } from './palette-marker-tiles';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';

const ids = (tiles: PaletteTileDef[]) => tiles.map((t) => t.id);

// Raw elements, only the fields a signature reads.
const el = (e: Record<string, unknown>) =>
  ({ id: 'x', x: 0, y: 0, width: 1, height: 1, ...e }) as unknown as Element;

describe('elementTileSections', () => {
  // docs/specs/012-collaboration/workshop-mode.md "The palette": the meeting palette's tiles are here; a leaving one
  // is not, and the Search never offers it.
  it('holds the meeting palette here, and no leaving tile', () => {
    const { here } = elementTileSections({ mode: 'workshop', hasImage: true });
    expect(ids(here)).toEqual(expect.arrayContaining(['tools:sticky', 'tools:room']));
    expect(ids(here)).not.toContain('tools:frame');
    expect(ids(here)).not.toContain('data:pie');
    expect(ids(here)).not.toContain('tools:arrow');
  });
});

describe("Draw mode's markers", () => {
  const drawTiles = markerTiles(DEFAULT_WHITEBOARD_PREFS, 'light');

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
});

describe('tile and element signatures', () => {
  const sigOf = (id: string) => tileSignature(tileById(id)!);

  it('tell apart the choices an element records', () => {
    expect(elementSignature(el({ type: 'sticky' }))).toBe(sigOf('tools:sticky'));
    expect(elementSignature(el({ type: 'freehand', pen: 'highlighter' }))).not.toBe(
      sigOf('tools:pencil'),
    );
    expect(elementSignature(el({ type: 'arrow', arrowEnds: 'none' }))).toBe(sigOf('tools:line'));
    expect(elementSignature(el({ type: 'arrow' }))).toBe(sigOf('tools:arrow'));
  });

  it('gives the catalogue tiles none', () => {
    const catalogue = PALETTE_TILES.filter((t) => t.action.type === 'sticker');
    for (const t of catalogue) expect(tileSignature(t), t.id).toBeNull();
  });
});

describe('mergeByName', () => {
  const t = (id: string) => tileById(id)!;

  it('puts a name match from a later list above a keyword-only match from an earlier one', () => {
    // "flowchart" is a keyword of the diamond; "Pie Chart" names the pie (its caption here, to read in full).
    const pie = { ...t('data:pie'), caption: 'Pie Chart' };
    expect(ids(mergeByName('chart', [t('shapes:diamond')], [pie]))).toEqual([
      'data:pie',
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
