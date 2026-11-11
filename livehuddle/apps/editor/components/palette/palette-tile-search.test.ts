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
    expect(elementSignature(el({ type: 'text' }))).toBe(sigOf('tools:text'));
  });

  // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4) has no tile.
  it('matches no tile for a stored arrow, line or pen stroke', () => {
    const sigs = new Set(PALETTE_TILES.map(tileSignature));
    for (const stored of [
      el({ type: 'arrow' }),
      el({ type: 'arrow', arrowEnds: 'none' }),
      el({ type: 'freehand', pen: 'highlighter' }),
    ])
      expect(sigs.has(elementSignature(stored)), stored.type).toBe(false);
  });

  it('gives the catalogue tiles none', () => {
    const catalogue = PALETTE_TILES.filter((t) => t.action.type === 'sticker');
    for (const t of catalogue) expect(tileSignature(t), t.id).toBeNull();
  });
});

describe('mergeByName', () => {
  const t = (id: string) => tileById(id)!;

  it('puts a name match from a later list above a keyword-only match from an earlier one', () => {
    // "seat" is a keyword of the chair; "Seat Bank" names the sofa (its caption here, to read in full).
    const bank = { ...t('tools:sofa'), caption: 'Seat Bank' };
    expect(ids(mergeByName('seat', [t('tools:chair')], [bank]))).toEqual([
      'tools:sofa',
      'tools:chair',
    ]);
  });

  it('keeps list order among equals, and on an empty query', () => {
    const lists = [[t('tools:chair')], [t('tools:desk')]];
    expect(ids(mergeByName('', ...lists))).toEqual(['tools:chair', 'tools:desk']);
    expect(ids(mergeByName('zz', ...lists))).toEqual(['tools:chair', 'tools:desk']);
  });
});

describe('rankTiles', () => {
  const tiles = ['tools:copier', 'tools:coffee-machine', 'tools:chair'].map((id) => tileById(id)!);

  it('ranks a name match above a keyword-only one', () => {
    // "chair" is the chair's name; the copier and the coffee machine do not mention it.
    expect(ids(rankTiles('chair', tiles))[0]).toBe('tools:chair');
    // "espresso" is only a keyword of the coffee machine.
    expect(ids(rankTiles('espresso', tiles))).toEqual(['tools:coffee-machine']);
  });

  it('keeps input order on an empty or blank query', () => {
    expect(ids(rankTiles('  ', tiles))).toEqual(ids(tiles));
  });

  it('keeps input order between equal ranks', () => {
    // Every name starts with "c".
    expect(ids(rankTiles('c', tiles)).slice(0, 2)).toEqual([
      'tools:copier',
      'tools:coffee-machine',
    ]);
  });
});
