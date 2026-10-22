import { describe, expect, it } from 'vitest';
import { barCategoriesFor } from './bar-categories';
import { paletteCategoriesFor } from './palette-layouts';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar").

const bar = () =>
  barCategoriesFor(
    paletteCategoriesFor('pages').map((c) => ({ ...c, content: null })),
    (groups) => groups.map((g) => g.id).join(','),
  );

describe('the category bar’s categories', () => {
  it('drops Popular, keeping the rest in order, names shortened', () => {
    const cats = bar();
    expect(cats.map((c) => c.id)).toEqual(
      paletteCategoriesFor('pages')
        .map((c) => c.id)
        .filter((id) => id !== 'popular'),
    );
    expect(cats.find((c) => c.id === 'write')?.label).toBe('Write');
  });

  it('names every category in one word', () => {
    for (const c of bar()) expect(c.label, c.id).not.toMatch(/\s|&/);
  });
});
