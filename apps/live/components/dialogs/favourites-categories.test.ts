import { describe, expect, it } from 'vitest';

import { PALETTE_CATEGORIES } from '@/components/palette/palette-category-tabs';
import { tilesForCategory } from '@/components/palette/palette-tile-defs';

// Drift guard for the Edit Favourites dialog's category pills (spec/78).
//
// The dialog used to keep its own hand-written list of categories. It drifted
// silently: by the time it was noticed it was offering a "Tools" category that
// had been deleted and hiding six that existed. The pills now derive from
// PALETTE_CATEGORIES, and these tests are why that stays true.

// The dialog's own rule, restated once here rather than exported: everything
// but Favourites, minus any category with nothing to show.
const OPEN_ENDED = ['icons', 'stickers', 'technology'];
const pillIds = PALETTE_CATEGORIES.filter(
  (c) => c.id !== 'favourites' && (OPEN_ENDED.includes(c.id) || tilesForCategory(c.id).length > 0),
).map((c) => c.id);

describe('Edit Favourites category pills', () => {
  it('offers every palette category that has something in it', () => {
    const expected = PALETTE_CATEGORIES.map((c) => c.id).filter(
      (id) => id !== 'favourites' && (OPEN_ENDED.includes(id) || tilesForCategory(id).length > 0),
    );
    expect(pillIds).toEqual(expected);
  });

  it('includes the categories the stale list was missing', () => {
    // Named explicitly so a regression that dropped them fails here rather
    // than agreeing with a derivation that also broke.
    for (const id of ['build', 'write', 'draw', 'media', 'stickers', 'collaborate']) {
      expect(pillIds).toContain(id);
    }
  });

  it('no longer offers the deleted Tools category', () => {
    // Tools was dissolved into top-level categories in spec/110; a pill for it
    // led to an empty grid.
    expect(pillIds).not.toContain('tools');
  });

  it('never offers Favourites as a source to pick from', () => {
    // It is what the dialog edits, so listing it would be circular.
    expect(pillIds).not.toContain('favourites');
  });

  it('never leads to an empty grid', () => {
    for (const id of pillIds) {
      if (OPEN_ENDED.includes(id)) continue;
      expect(tilesForCategory(id).length).toBeGreaterThan(0);
    }
  });
});
