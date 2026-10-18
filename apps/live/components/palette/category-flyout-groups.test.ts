import { describe, expect, it } from 'vitest';
import {
  barLabel,
  CATEGORY_BAR_MODES,
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

const tiles = (mode: 'diagram' | 'facilitate' | 'pages', id: string): PaletteTileDef[] =>
  paletteCategoriesFor(mode).find((c) => c.id === id)?.tiles ?? [];

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
  it('is Diagram’s, Facilitate’s and Pages’s strip, not Plan’s or Draw’s', () => {
    expect([...CATEGORY_BAR_MODES].sort()).toEqual(['diagram', 'facilitate', 'pages']);
  });

  it('names every category in one word', () => {
    expect(barLabel('write', 'Write & Build')).toBe('Write');
    expect(barLabel('my-shapes', 'My shapes')).toBe('Library');
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

  it('words a line its own way where a mode fills the category differently', () => {
    expect(flyoutTagline('write', 'fallback', 'facilitate')).toBe(
      'Words, notes, tables and checklists.',
    );
    expect(flyoutTagline('write', 'fallback', 'diagram')).toBe(
      'Words on the canvas: text, notes and comments.',
    );
    expect(flyoutTagline('unknown', 'fallback')).toBe('fallback');
  });
});

describe('a flyout’s groups', () => {
  it('heads Shapes, Draw, Layout, Data and Components by the tile that starts each group', () => {
    expect(flyoutGroups('shapes', tiles('diagram', 'shapes')).map((g) => g.title)).toEqual([
      'Basics',
      'Flowchart',
      'More Shapes',
    ]);
    expect(flyoutGroups('draw', tiles('diagram', 'draw')).map((g) => g.title)).toEqual([
      'Pens',
      'Outlines',
      'Connectors',
    ]);
    expect(flyoutGroups('layout', tiles('diagram', 'layout')).map((g) => g.title)).toEqual([
      'Containers',
      'Parts',
    ]);
    expect(flyoutGroups('data', tiles('pages', 'data')).map((g) => g.title)).toEqual([
      'Charts',
      'Meters',
      'Timelines and Tables',
    ]);
    expect(flyoutGroups('components', tiles('pages', 'components')).map((g) => g.title)).toEqual([
      'Code and Lists',
      'Page Blocks',
      'Layout',
    ]);
    expect(flyoutGroups('data', tiles('facilitate', 'data')).map((g) => g.title)).toEqual([
      'Charts',
      'Meters',
    ]);
  });

  it('shows one block, unheaded, when not every group has a name', () => {
    const groups = flyoutGroups('write', tiles('facilitate', 'write'));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBeNull();
    expect(groups[0]!.tiles).toHaveLength(tiles('facilitate', 'write').length);
    expect(flyoutGroups('x', [tile('a', true), tile('b')])).toEqual([
      {
        id: 'a',
        title: null,
        tiles: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
      },
    ]);
  });

  it('never splits Popular, and has nothing to show for no tiles', () => {
    expect(flyoutGroups('popular', tiles('diagram', 'popular'))).toHaveLength(1);
    expect(flyoutGroups('shapes', [])).toEqual([]);
    // One group: no heading, whatever its first tile is called.
    expect(flyoutGroups('shapes', [tile('shapes:square')])[0]!.title).toBeNull();
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
