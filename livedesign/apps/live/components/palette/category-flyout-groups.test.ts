import { describe, expect, it } from 'vitest';
import {
  barLabel,
  CATEGORY_BAR_MODES,
  flyoutCardColumns,
  flyoutColumns,
  flyoutGroups,
  flyoutLayout,
  flyoutTagline,
  SHORT_CARD_LIST,
} from './category-flyout-groups';
import { paletteCategoriesFor } from './palette-layouts';
import type { PaletteTileDef } from './palette-tile-defs';

// The category flyout's arrangement (docs/specs/007-editor/toolbar-layout.md "The category bar").

const tiles = (id: string): PaletteTileDef[] =>
  paletteCategoriesFor('pages').find((c) => c.id === id)?.tiles ?? [];

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
  it('is Pages’s strip', () => {
    expect([...CATEGORY_BAR_MODES]).toEqual(['pages']);
  });

  it('names every category in one word', () => {
    expect(barLabel('write', 'Write & Build')).toBe('Write');
    expect(barLabel('shapes', 'Shapes')).toBe('Shapes');
  });
});

describe('a flyout’s layout', () => {
  it('draws pictures where the glyph is the answer, cards otherwise', () => {
    expect(flyoutLayout('shapes')).toBe('grid');
    expect(flyoutLayout('popular')).toBe('grid');
    expect(flyoutLayout('build')).toBe('cards');
    expect(flyoutColumns('shapes')).toBe(5);
    expect(flyoutColumns('popular')).toBe(4);
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
    expect(flyoutGroups('data', tiles('data')).map((g) => g.title)).toEqual([
      'Charts',
      'Meters',
      'Tables',
    ]);
    expect(flyoutGroups('components', tiles('components')).map((g) => g.title)).toEqual([
      'Layout',
      'Page Blocks',
      'Code and Lists',
    ]);
  });

  it('never splits Popular, and has nothing to show for no tiles', () => {
    expect(flyoutGroups('popular', tiles('popular'))).toHaveLength(1);
    expect(flyoutGroups('x', [tile('a', true), tile('b')])).toEqual([
      {
        id: 'a',
        title: null,
        tiles: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
      },
    ]);
    expect(flyoutGroups('shapes', [])).toEqual([]);
    // One group: no heading, whatever its first tile is called.
    expect(flyoutGroups('shapes', [tile('shapes:square')])[0]!.title).toBeNull();
  });
});
