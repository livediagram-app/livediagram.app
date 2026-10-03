import { describe, expect, it } from 'vitest';

import { paletteCategoriesFor } from '@/components/palette/palette-layouts';

// Drift guard for the Edit Favourites dialog's category pills (docs/specs/010-palette/palette-favourites.md).
//
// The dialog used to keep its own hand-written list of categories. It drifted
// silently: by the time it was noticed it was offering a "Tools" category that
// had been deleted and hiding six that existed. The pills now derive from
// Diagram mode's palette layout (Favourites is Diagram's category), and these
// tests are why that stays true.

// The dialog's own rule, restated once here rather than exported: everything
// but Favourites, minus any category with nothing to show.
const OPEN_ENDED = ['icons', 'stickers', 'technology'];
const diagram = paletteCategoriesFor('diagram');
const pillIds = diagram
  .filter((c) => c.id !== 'favourites' && (OPEN_ENDED.includes(c.id) || (c.tiles?.length ?? 0) > 0))
  .map((c) => c.id);

describe('Edit Favourites category pills', () => {
  it("offers every category of Diagram mode's palette that has something in it", () => {
    expect(pillIds).toEqual(
      diagram.map((c) => c.id).filter((id) => id !== 'favourites' && id !== 'my-shapes'),
    );
  });

  it('includes the categories the stale list was missing', () => {
    // Named explicitly so a regression that dropped them fails here rather
    // than agreeing with a derivation that also broke. 'collaborate' used to
    // be on this list and is now part of 'behaviour' (docs/specs/010-palette/palette-top-level-categories.md).
    for (const id of ['build', 'write', 'draw', 'media', 'stickers', 'behaviour']) {
      expect(pillIds).toContain(id);
    }
  });

  it('no longer offers the merged-away Collaborate category', () => {
    // Its elements are Behaviours sub-groups now; a pill for it led nowhere.
    expect(pillIds).not.toContain('collaborate');
  });

  it('no longer offers the deleted Tools category', () => {
    // Tools was dissolved into top-level categories in docs/specs/010-palette/palette-top-level-categories.md; a pill for it
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
      expect(diagram.find((c) => c.id === id)!.tiles!.length).toBeGreaterThan(0);
    }
  });
});
