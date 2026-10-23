import { describe, expect, it } from 'vitest';
import {
  barLabel,
  flyoutCardColumns,
  flyoutColumns,
  flyoutGroups,
  flyoutKeyTarget,
  flyoutLayout,
  flyoutTagline,
  SHORT_CARD_LIST,
} from './category-flyout-groups';
import { paletteCategoriesFor } from './palette-layouts';
import type { PaletteTileDef } from './palette-tile-defs';

// The category flyout's arrangement (docs/specs/007-editor/toolbar-layout.md "The category bar").

const tiles = (id: string): PaletteTileDef[] =>
  paletteCategoriesFor().find((c) => c.id === id)?.tiles ?? [];

const tile = (id: string, dividerAfter = false): PaletteTileDef => ({
  id,
  label: id,
  description: '',
  icon: null,
  section: 'shapes',
  action: { type: 'text' },
  ...(dividerAfter ? { dividerAfter } : {}),
});

describe('the category bar', () => {
  it('names every category in one word', () => {
    expect(barLabel('write', 'Write & Build')).toBe('Write');
    expect(barLabel('shapes', 'Shapes')).toBe('Shapes');
  });
});

describe('a flyout’s layout', () => {
  it('draws pictures where the glyph is the answer, cards otherwise', () => {
    expect(flyoutLayout('shapes')).toBe('grid');
    expect(flyoutLayout('build')).toBe('cards');
    expect(flyoutColumns('shapes')).toBe(5);
    expect(flyoutColumns('anything-else')).toBe(5);
  });

  it('gives a short card list one column, so a small category is a small flyout', () => {
    expect(flyoutCardColumns(2)).toBe(1);
    expect(flyoutCardColumns(SHORT_CARD_LIST)).toBe(1);
    expect(flyoutCardColumns(SHORT_CARD_LIST + 1)).toBe(2);
  });

  it('words a category’s line, or falls back on its own', () => {
    expect(flyoutTagline('write', 'fallback')).toBe(
      'Words on the canvas: text, notes and comments.',
    );
    expect(flyoutTagline('unknown', 'fallback')).toBe('fallback');
  });
});

describe('a flyout’s groups', () => {
  it('heads Data and Components by the tile that starts each group', () => {
    expect(flyoutGroups(tiles('data')).map((g) => g.title)).toEqual(['Charts', 'Meters', 'Tables']);
    expect(flyoutGroups(tiles('components')).map((g) => g.title)).toEqual([
      'Layout',
      'Page Blocks',
      'Code and Lists',
    ]);
  });

  it('keeps a half-named category as one block, and has nothing to show for no tiles', () => {
    expect(flyoutGroups([tile('a', true), tile('b')])).toEqual([
      {
        id: 'a',
        title: null,
        tiles: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
      },
    ]);
    expect(flyoutGroups([])).toEqual([]);
    // One group: no heading, whatever its first tile is called.
    expect(flyoutGroups([tile('shapes:square')])[0]!.title).toBeNull();
  });
});

describe('arrow keys in a flyout', () => {
  // Two rows of three, then a lone fourth row item under the middle.
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 0, y: 60 },
    { x: 100, y: 60 },
    { x: 200, y: 60 },
    { x: 110, y: 140 },
  ];

  it('steps through the list with Left and Right, stopping at the ends', () => {
    expect(flyoutKeyTarget('ArrowRight', 0, points)).toBe(1);
    expect(flyoutKeyTarget('ArrowRight', 6, points)).toBeNull();
    expect(flyoutKeyTarget('ArrowLeft', 3, points)).toBe(2);
    expect(flyoutKeyTarget('ArrowLeft', 0, points)).toBeNull();
  });

  it('moves a row with Up and Down, to the nearest item, across groups', () => {
    expect(flyoutKeyTarget('ArrowDown', 1, points)).toBe(4);
    expect(flyoutKeyTarget('ArrowDown', 5, points)).toBe(6);
    expect(flyoutKeyTarget('ArrowUp', 6, points)).toBe(4);
    expect(flyoutKeyTarget('ArrowUp', 0, points)).toBeNull();
    expect(flyoutKeyTarget('ArrowDown', 6, points)).toBeNull();
  });

  it('jumps to the ends with Home and End, and ignores other keys', () => {
    expect(flyoutKeyTarget('Home', 4, points)).toBe(0);
    expect(flyoutKeyTarget('End', 0, points)).toBe(6);
    expect(flyoutKeyTarget('Enter', 0, points)).toBeNull();
    expect(flyoutKeyTarget('ArrowRight', 0, [])).toBeNull();
  });
});
