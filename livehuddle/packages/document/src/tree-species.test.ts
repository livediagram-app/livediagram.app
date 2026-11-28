// docs/specs/009-elements/office.md "Tree species": a tree's species is stored in `variant`, the Oak when absent or
// unknown; every species draws on the Oak's grid and changes in place from the element menu's Type.
import { describe, expect, it } from 'vitest';
import {
  applyShapeVariant,
  changesType,
  createShape,
  OFFICE_ART,
  pieceVariant,
  storesVariant,
  TREE_SPECIES_ART,
  TREE_VARIANTS,
  treeArt,
  treeSpecies,
  variantsOf,
  withPieceType,
} from './index';

describe('tree species', () => {
  it('stores a species in variant, the Oak first', () => {
    expect(storesVariant('tree')).toBe(true);
    expect(variantsOf('tree')).toEqual(TREE_VARIANTS);
    expect(TREE_VARIANTS[0]).toBe('oak');
    const pine = applyShapeVariant(createShape('tree', 0, 0), 'pine');
    expect(pine.variant).toBe('pine');
    // Every species keeps the Oak's size, so its trunk stands on the same footprint.
    expect([pine.width, pine.height]).toEqual([120, 160]);
    expect(pieceVariant({ shape: 'tree' })).toBe('oak');
    expect(pieceVariant({ shape: 'tree', variant: 'baobab' })).toBe('oak');
  });

  it('draws the Oak as the tree always was, and every other species its own drawing', () => {
    expect(treeArt(undefined)).toBe(OFFICE_ART.tree);
    expect(treeArt('baobab')).toBe(OFFICE_ART.tree);
    expect(treeSpecies('willow')).toBe('willow');
    const parts = new Set<string>();
    for (const v of TREE_VARIANTS) {
      const art = TREE_SPECIES_ART[v];
      expect([art.front.width, art.front.height], v).toEqual([120, 160]);
      expect(art.front.parts.length, v).toBeGreaterThan(5);
      expect(art.back).toBe(art.front);
      parts.add(JSON.stringify(art.front.parts));
    }
    expect(parts.size).toBe(TREE_VARIANTS.length);
  });

  it('changes species in place from the Type section, keeping its spot', () => {
    expect(changesType('tree')).toBe(true);
    const oak = { ...createShape('tree', 100, 200), id: 't', label: 'Old oak' };
    const palm = withPieceType(oak, 'palm');
    expect(palm).toMatchObject({ id: 't', variant: 'palm', x: 100, y: 200, label: 'Old oak' });
    expect(withPieceType(palm, 'oak').variant).toBeUndefined();
  });
});
