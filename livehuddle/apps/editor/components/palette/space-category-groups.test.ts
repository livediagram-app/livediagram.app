import { describe, expect, it } from 'vitest';
import { tileById, tilesForCategory } from './palette-tile-defs';
import {
  groupedSpaceTiles,
  SPACE_CATEGORY_GROUPS,
  SPACE_GROUP_NAMES,
} from './space-category-groups';

// The named groups inside a Space category's flyout (docs/specs/010-palette/palette-top-level-categories.md "Groups
// in a flyout").

const ids = (categoryId: string) => tilesForCategory(categoryId).map((t) => t.id);

describe('the Space categories’ groups', () => {
  it('lists each piece once, and only its category’s own pieces', () => {
    for (const [categoryId, groups] of Object.entries(SPACE_CATEGORY_GROUPS)) {
      const listed = groups.flatMap((g) => g.tiles);
      expect(new Set(listed).size, categoryId).toBe(listed.length);
      for (const id of listed) {
        expect(tileById(id), `${categoryId}: ${id}`).toBeDefined();
        expect(ids(categoryId), `${categoryId}: ${id}`).toContain(id);
      }
    }
  });

  it('names each group in Title Case, by its first tile, with no name used twice in a category', () => {
    for (const groups of Object.values(SPACE_CATEGORY_GROUPS)) {
      expect(new Set(groups.map((g) => g.name)).size).toBe(groups.length);
      for (const g of groups) {
        expect(SPACE_GROUP_NAMES[g.tiles[0]!]).toBe(g.name);
        for (const word of g.name.split(' ').filter((w) => w !== 'and'))
          expect(word[0], g.name).toBe(word[0]!.toUpperCase());
      }
    }
  });

  it('lays the groups out with a divider between two, none after the last', () => {
    expect(groupedSpaceTiles('collab-recreation', ids('collab-recreation'), '|')).toEqual([
      'tools:bar',
      'tools:bar-stool',
      'tools:drinks-cabinet',
      'tools:drinks-fridge',
      '|',
      'tools:ping-pong-table',
      'tools:pool-table',
      'tools:foosball-table',
      'tools:arcade-machine',
      'tools:dartboard',
      '|',
      'tools:jukebox',
      'tools:fireplace',
    ]);
  });

  it('puts a piece no group lists in the last group, and skips a listed piece the category lacks', () => {
    // A new garden piece lands by its tileGroup alone; a garden without a pond still draws its groups.
    const own = [...ids('collab-garden').filter((id) => id !== 'tools:pond'), 'tools:sundial'];
    const tiles = groupedSpaceTiles('collab-garden', own, '|')!;
    expect(tiles).not.toContain('tools:pond');
    expect(tiles.slice(-4)).toEqual(['|', 'tools:fountain', 'tools:campfire', 'tools:sundial']);
  });

  it('drops a group with none of its pieces, so no two dividers meet', () => {
    const games = new Set([
      'tools:ping-pong-table',
      'tools:pool-table',
      'tools:foosball-table',
      'tools:arcade-machine',
      'tools:dartboard',
    ]);
    const own = ids('collab-recreation').filter((id) => !games.has(id));
    expect(groupedSpaceTiles('collab-recreation', own, '|')).toEqual([
      'tools:bar',
      'tools:bar-stool',
      'tools:drinks-cabinet',
      'tools:drinks-fridge',
      '|',
      'tools:jukebox',
      'tools:fireplace',
    ]);
  });

  it('leaves a category with no groups to its catalogue order', () => {
    expect(groupedSpaceTiles('collab-seating', ids('collab-seating'), '|')).toBeNull();
  });
});
