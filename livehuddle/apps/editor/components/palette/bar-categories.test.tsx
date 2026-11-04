import { describe, expect, it } from 'vitest';
import { barCategoriesFor } from './bar-categories';
import { paletteCategoriesFor } from './palette-layouts';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar",
// docs/specs/012-collaboration/workshop-mode.md "The palette").

const bar = () =>
  barCategoriesFor(paletteCategoriesFor('workshop').map((c) => ({ ...c, content: null })));

describe('the category bar’s categories', () => {
  it('shows the meeting palette less Popular, with no Session category', () => {
    const cats = bar();
    expect(cats.map((c) => c.id)).toEqual([
      'write',
      'frame',
      'collab-navigate',
      'collab-react',
      'collab-mode',
      'icons',
      'stickers',
      'media',
    ]);
    expect(cats.map((c) => c.label)).toEqual([
      'Write',
      'Frame',
      'Navigate',
      'React',
      'Modes',
      'Icons',
      'Stickers',
      'Media',
    ]);
  });

  it('names every category in one word', () => {
    for (const c of bar()) expect(c.label, c.id).not.toMatch(/\s/);
  });

  it('keeps the bands: Write and Frame, then the meeting categories, then the decorations', () => {
    expect(bar().map((c) => c.group)).toEqual([0, 0, 6, 6, 6, 2, 2, 2]);
  });
});
