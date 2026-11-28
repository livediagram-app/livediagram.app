import { describe, expect, it } from 'vitest';
import { TREE_VARIANTS } from '@livehuddle/document';
import { PALETTE_TILES } from './palette-tile-defs';
import { TREE_PRESET_TILES } from './palette-tree-presets';
import { pieceTypeChoices } from './piece-type-tiles';

// docs/specs/009-elements/office.md "Tree species": the Garden's Tree tile opens seven trees, as the Room tile opens
// its presets, and a placed tree's Type section offers the same seven.

const tile = (id: string) => PALETTE_TILES.find((t) => t.id === id)!;

describe('the tree species tiles', () => {
  it('hang under the Tree tile, one per species, the Oak placing a plain tree', () => {
    expect(tile('tools:tree').variants).toBe(TREE_PRESET_TILES);
    expect(tile('tools:tree').variantsHint).toBeTruthy();
    expect(TREE_PRESET_TILES.map((t) => (t.action as { variant?: string }).variant)).toEqual([
      undefined,
      ...TREE_VARIANTS.slice(1),
    ]);
    for (const t of TREE_PRESET_TILES) {
      expect(t.action).toMatchObject({ type: 'shape', kind: 'tree' });
      expect(t.icon).toBeTruthy();
    }
    // Not tiles of their own: the Garden keeps the one Tree.
    expect(PALETTE_TILES.some((t) => t.id === 'tools:tree-pine')).toBe(false);
  });

  it("offers every species in a tree's Type section, named as its tile", () => {
    expect(pieceTypeChoices('tree').map((c) => c.type)).toEqual([...TREE_VARIANTS]);
    expect(pieceTypeChoices('tree').map((c) => c.label)).toContain('Cherry Blossom');
  });
});
