import { describe, expect, it } from 'vitest';
import {
  barLabel,
  flyoutCardColumns,
  flyoutColumns,
  flyoutGroups,
  flyoutLayout,
  SHORT_CARD_LIST,
} from './category-flyout-groups';
import { paletteCategories } from './palette-layouts';
import type { PaletteTileDef } from './palette-tile-defs';

// The category flyout's arrangement (docs/specs/007-editor/toolbar-layout.md "The category bar").

const tiles = (id: string): PaletteTileDef[] =>
  paletteCategories().find((c) => c.id === id)?.tiles ?? [];

const tile = (id: string, dividerAfter = false): PaletteTileDef => ({
  id,
  label: id,
  description: '',
  icon: null,
  section: 'tools',
  action: { type: 'text' },
  ...(dividerAfter ? { dividerAfter } : {}),
});

describe('the category bar', () => {
  it('names every category in one word', () => {
    expect(barLabel('write', 'Write & Build')).toBe('Write');
    expect(barLabel('popular', 'Popular')).toBe('Popular');
  });
});

describe('a flyout’s layout', () => {
  it('draws pictures where the glyph is the answer, cards otherwise', () => {
    expect(flyoutLayout('popular')).toBe('grid');
    expect(flyoutLayout('build')).toBe('cards');
    expect(flyoutColumns('popular')).toBe(4);
    expect(flyoutColumns('anything-else')).toBe(5);
  });

  it('gives a short card list one column, so a small category is a small flyout', () => {
    expect(flyoutCardColumns(2)).toBe(1);
    expect(flyoutCardColumns(SHORT_CARD_LIST)).toBe(1);
    expect(flyoutCardColumns(SHORT_CARD_LIST + 1)).toBe(2);
  });
});

describe('a flyout’s groups', () => {
  it('shows each Space category but Rooms, Perks, Play and Garden as one block, unheaded', () => {
    for (const id of ['collab-travel', 'collab-seating', 'collab-meeting']) {
      const groups = flyoutGroups(id, tiles(id));
      expect(groups, id).toHaveLength(1);
      expect(groups[0]!.title, id).toBeNull();
    }
  });

  // docs/specs/010-palette/palette-top-level-categories.md "Rooms opens on Build".
  it('opens Rooms on its Build group (Room, Room Builder, Corridor, Door, Window), then Floor', () => {
    const groups = flyoutGroups('collab-rooms', tiles('collab-rooms'));
    expect(groups.map((g) => g.title)).toEqual(['Build', 'Floor']);
    expect(groups[0]!.tiles.map((t) => t.id)).toEqual([
      'tools:room',
      'tools:room-builder',
      'tools:corridor',
      'tools:wall-door',
      'tools:window',
    ]);
  });

  // docs/specs/010-palette/palette-top-level-categories.md "Groups in a flyout".
  it('splits Play into Bar, Games, Gym and Lounge', () => {
    const groups = flyoutGroups('collab-recreation', tiles('collab-recreation'));
    expect(groups.map((g) => [g.title, g.tiles.map((t) => t.id)])).toEqual([
      ['Bar', ['tools:bar', 'tools:bar-stool', 'tools:drinks-cabinet', 'tools:drinks-fridge']],
      [
        'Games',
        [
          'tools:ping-pong-table',
          'tools:pool-table',
          'tools:foosball-table',
          'tools:arcade-machine',
          'tools:dartboard',
        ],
      ],
      ['Gym', ['tools:treadmill', 'tools:weight-bench']],
      ['Lounge', ['tools:jukebox', 'tools:fireplace', 'tools:pet-bed']],
    ]);
  });

  it('splits Garden into Plants, Paths and Fences, Furniture, Features and Parking', () => {
    const groups = flyoutGroups('collab-garden', tiles('collab-garden'));
    expect(groups.map((g) => [g.title, g.tiles.map((t) => t.id)])).toEqual([
      ['Plants', ['tools:outdoor-plant', 'tools:tree', 'tools:grass']],
      ['Paths and Fences', ['tools:garden-path', 'tools:garden-fence']],
      [
        'Furniture',
        ['tools:bench', 'tools:picnic-table', 'tools:hammock', 'tools:garden-umbrella'],
      ],
      ['Features', ['tools:fountain', 'tools:pond', 'tools:swimming-pool', 'tools:campfire']],
      ['Parking', ['tools:car-park', 'tools:bike-rack']],
    ]);
  });

  // docs/specs/009-elements/office-amenities.md "Where they live".
  it('splits Perks into Office, Kitchen and Restroom', () => {
    const groups = flyoutGroups('collab-amenities', tiles('collab-amenities'));
    expect(groups.map((g) => g.title)).toEqual(['Office', 'Kitchen', 'Restroom']);
    expect(groups.map((g) => g.tiles[0]!.id)).toEqual([
      'tools:plant',
      'tools:water-cooler',
      'tools:restroom',
    ]);
    expect(groups.map((g) => g.tiles.length)).toEqual([7, 8, 4]);
  });

  it('shows one block, unheaded, when not every group has a name', () => {
    const groups = flyoutGroups('write', tiles('write'));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBeNull();
    expect(groups[0]!.tiles).toHaveLength(tiles('write').length);
    expect(flyoutGroups('x', [tile('a', true), tile('b')])).toEqual([
      {
        id: 'a',
        title: null,
        tiles: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
      },
    ]);
  });

  it('never splits Popular, and has nothing to show for no tiles', () => {
    expect(flyoutGroups('popular', tiles('popular'))).toHaveLength(1);
    expect(flyoutGroups('write', [])).toEqual([]);
    // One group: no heading, whatever its first tile is called.
    expect(flyoutGroups('write', [tile('tools:text')])[0]!.title).toBeNull();
  });
});
