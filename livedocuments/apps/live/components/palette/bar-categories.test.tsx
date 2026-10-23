import { describe, expect, it } from 'vitest';
import { barCategoriesFor } from './bar-categories';
import { paletteCategoriesFor } from './palette-layouts';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar").

const bar = () => barCategoriesFor(paletteCategoriesFor().map((c) => ({ ...c, content: null })));

describe('the category bar’s categories', () => {
  it('keeps every category in order, names shortened', () => {
    const cats = bar();
    expect(cats.map((c) => c.id)).toEqual(paletteCategoriesFor().map((c) => c.id));
    expect(cats.find((c) => c.id === 'write')?.label).toBe('Write');
  });

  it('names every category in one word', () => {
    for (const c of bar()) expect(c.label, c.id).not.toMatch(/\s|&/);
  });
});
