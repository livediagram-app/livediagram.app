// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// Pages' own tiles, and the ranking.
import { describe, expect, it } from 'vitest';
import type { Element } from '@livedocuments/document';
import {
  elementSignature,
  mergeByName,
  paletteElementTiles,
  rankTiles,
  searchableElementTiles,
  searchElementTiles,
  tileSignature,
} from './palette-tile-search';
import { PALETTE_TILES, tileById, type PaletteTileDef } from './palette-tile-defs';

const ids = (tiles: PaletteTileDef[]) => tiles.map((t) => t.id);

// Raw elements, only the fields a signature reads.
const el = (e: Record<string, unknown>) =>
  ({ id: 'x', x: 0, y: 0, width: 1, height: 1, ...e }) as unknown as Element;

describe('searchableElementTiles', () => {
  it('lists every tile of the palette once, in layout order', () => {
    const tiles = paletteElementTiles();
    expect(new Set(ids(tiles)).size).toBe(tiles.length);
    // Shapes leads, so its Square comes first.
    expect(tiles[0]?.id).toBe('shapes:square');
    expect(ids(searchableElementTiles({ hasImage: true }))).toEqual(ids(tiles));
    expect(ids(tiles)).toEqual(expect.arrayContaining(['data:pie', 'devices:phone']));
  });

  it('leaves out the image-upload tiles where the editor has none', () => {
    const tiles = searchableElementTiles({ hasImage: false });
    const needsImage = PALETTE_TILES.filter((t) => t.needsImage).map((t) => t.id);
    expect(ids(tiles).filter((id) => needsImage.includes(id))).toEqual([]);
  });
});

describe('searchElementTiles', () => {
  it('finds a tile by a synonym', () => {
    const found = searchElementTiles({ query: 'database', hasImage: true });
    expect(ids(found)).toContain('shapes:cylinder');
  });

  it('finds nothing for nonsense', () => {
    expect(searchElementTiles({ query: 'zzqqxx', hasImage: true })).toEqual([]);
  });

  it('lists only the element types on the tab before anything is typed', () => {
    const onTab = searchElementTiles({
      query: '  ',
      hasImage: true,
      tabElements: [
        el({ type: 'shape', shape: 'circle' }),
        el({ type: 'shape', shape: 'circle' }),
        el({ type: 'sticky' }),
      ],
    });
    // Layout order (Shapes before Write), each type once.
    expect(ids(onTab)).toEqual(['shapes:circle', 'tools:sticky']);
  });

  it('lists nothing before typing on an empty tab', () => {
    expect(searchElementTiles({ query: '', hasImage: true })).toEqual([]);
  });
});

describe('tile and element signatures', () => {
  const sigOf = (id: string) => tileSignature(tileById(id)!);

  it('tell apart the choices an element records', () => {
    expect(elementSignature(el({ type: 'sticky' }))).toBe(sigOf('tools:sticky'));
    expect(elementSignature(el({ type: 'freehand' }))).toBe(sigOf('tools:polygon'));
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
    // The pie's name is Pie; the diamond's does not mention it.
    expect(ids(mergeByName('pie', [t('shapes:diamond')], [t('data:pie')]))).toEqual([
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

describe('a worst-case query', () => {
  it('ranks every tile well inside a keystroke budget', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) searchElementTiles({ query: 'e', hasImage: true });
    // 50 searches matching most of the catalogue; a keystroke runs one.
    expect((performance.now() - start) / 50).toBeLessThan(16);
  });
});
