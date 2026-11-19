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

const tiles = (mode: 'diagram' | 'workshop', id: string): PaletteTileDef[] =>
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
  it('is Diagram’s and Workshop’s strip, not Plan’s or Draw’s', () => {
    expect([...CATEGORY_BAR_MODES].sort()).toEqual(['diagram', 'workshop']);
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
    expect(flyoutTagline('write', 'fallback', 'workshop')).toBe(
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
      'BPMN',
    ]);
    // Workshop's Shapes keeps its own three (docs/specs/009-elements/bpmn.md "The palette").
    expect(flyoutGroups('shapes', tiles('workshop', 'shapes')).map((g) => g.title)).toEqual([
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
      'Pictures',
    ]);
    expect(flyoutGroups('data', tiles('workshop', 'data')).map((g) => g.title)).toEqual([
      'Charts',
      'Meters',
    ]);
  });

  it('shows one block, unheaded, when not every group has a name', () => {
    const groups = flyoutGroups('write', tiles('workshop', 'write'));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBeNull();
    expect(groups[0]!.tiles).toHaveLength(tiles('workshop', 'write').length);
    expect(flyoutGroups('x', [tile('a', true), tile('b')])).toEqual([
      {
        id: 'a',
        title: null,
        tiles: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
        optional: null,
      },
    ]);
  });

  it('marks Flowchart, More Shapes and BPMN, and only those, as optional groups with their own storage keys', () => {
    // toolbar-layout.md "Optional groups".
    const groups = flyoutGroups('shapes', tiles('diagram', 'shapes'));
    expect(groups.filter((g) => g.optional).map((g) => g.title)).toEqual([
      'Flowchart',
      'More Shapes',
      'BPMN',
    ]);
    expect(groups.find((g) => g.title === 'Flowchart')!.optional).toEqual({
      storageKey: 'livediagram:v2:palette-group-open:flowchart',
      telemetryType: 'FlowchartGroup',
    });
    expect(groups.at(-1)!.optional).toEqual({
      storageKey: 'livediagram:v2:palette-group-open:bpmn',
      telemetryType: 'BpmnGroup',
    });
  });

  it('never splits Popular, and has nothing to show for no tiles', () => {
    expect(flyoutGroups('popular', tiles('diagram', 'popular'))).toHaveLength(1);
    expect(flyoutGroups('shapes', [])).toEqual([]);
    // One group: no heading, whatever its first tile is called.
    expect(flyoutGroups('shapes', [tile('shapes:square')])[0]!.title).toBeNull();
  });
});
