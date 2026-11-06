// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// what it lists, and the ranking.
import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import {
  elementSignature,
  searchElementTiles,
  mergeByName,
  rankTiles,
  tileSignature,
} from './palette-tile-search';
import { PALETTE_TILES, tileById, type PaletteTileDef } from './palette-tile-defs';

const ids = (tiles: PaletteTileDef[]) => tiles.map((t) => t.id);

// Raw elements, only the fields a signature reads.
const el = (e: Record<string, unknown>) =>
  ({ id: 'x', x: 0, y: 0, width: 1, height: 1, ...e }) as unknown as Element;

describe('searchElementTiles', () => {
  // docs/specs/012-collaboration/workshop-mode.md "The palette": the meeting palette's tiles are listed; a leaving one
  // is not, and the Search never offers it.
  it('finds the meeting palette, and no leaving tile', () => {
    const found = ids(searchElementTiles({ query: 'room', hasImage: true }));
    expect(found).toContain('tools:room');
    expect(found).not.toContain('tools:frame');
    expect(ids(searchElementTiles({ query: 'pie', hasImage: true }))).not.toContain('data:pie');
  });

  it('lists the element types already on the tab before anything is typed', () => {
    const onTab = searchElementTiles({
      query: '',
      hasImage: true,
      tabElements: [el({ type: 'sticky' }), el({ type: 'sticky' })],
    });
    expect(ids(onTab)).toEqual(['tools:sticky']);
    expect(searchElementTiles({ query: '', hasImage: true })).toEqual([]);
  });

  it('leaves out the image tiles without image support', () => {
    const all = ids(searchElementTiles({ query: 'image', hasImage: true }));
    const none = ids(searchElementTiles({ query: 'image', hasImage: false }));
    expect(none.length).toBeLessThanOrEqual(all.length);
    for (const id of none) expect(tileById(id)!.needsImage, id).toBeFalsy();
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
