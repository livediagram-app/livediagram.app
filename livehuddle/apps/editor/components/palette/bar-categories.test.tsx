import { describe, expect, it } from 'vitest';
import { barCategoriesFor } from './bar-categories';
import { paletteCategories } from './palette-layouts';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar",
// docs/specs/012-collaboration/workshop-mode.md "The palette").

const bar = () => barCategoriesFor(paletteCategories().map((c) => ({ ...c, content: null })));

describe('the category bar’s categories', () => {
  it('shows the meeting palette less Popular, with no Session category', () => {
    const cats = bar();
    expect(cats.map((c) => c.id)).toEqual([
      'write',
      'collab-rooms',
      'collab-seating',
      'collab-amenities',
      'collab-recreation',
      'collab-garden',
      'collab-meeting',
      'collab-travel',
    ]);
    expect(cats.map((c) => c.label)).toEqual([
      'Write',
      'Rooms',
      'Seats',
      'Perks',
      'Play',
      'Garden',
      'Meet',
      'Travel',
    ]);
  });

  it('names every category in one word', () => {
    for (const c of bar()) expect(c.label, c.id).not.toMatch(/\s/);
  });

  // docs/specs/010-palette/palette-top-level-categories.md "The strip's order": a divider wherever the band changes,
  // so Write | Rooms..Meet | Travel (Stickers is search-only).
  it('keeps the bands: Write, the Space furnishing, Travel apart', () => {
    expect(bar().map((c) => c.group)).toEqual([0, 6, 6, 6, 6, 6, 6, 7]);
    const cats = bar();
    const dividedBefore = cats
      .filter((c, i) => i > 0 && cats[i - 1]!.group !== c.group)
      .map((c) => c.label);
    expect(dividedBefore).toEqual(['Rooms', 'Travel']);
  });
});
