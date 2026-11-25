import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { defaultPageBackground } from './page-default-background';
import { darkSlideBackground, slidesAreDark, withRecipeSlides } from './recipe-slides';
import { getBuiltInTheme } from './themes';
import type { Page, PageFill, Tab } from './index';

// docs/specs/011-theme/style-guide.md "Agents": a stage recipe's slides on the theme's night canvas.
const steel = defaultPageBackground(getBuiltInTheme('midnight'), 'slide').fill!;
const painted: PageFill = { kind: 'solid', color: '#fde68a' };
const slide = (id: string, fill?: PageFill): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...(fill ? { background: { fill } } : {}),
});
const deck = (pages: Page[]): Tab => ({
  id: 't',
  name: 'T',
  theme: 'midnight',
  elements: [],
  pages,
});
const fills = (t: Tab) => t.pages!.map((p) => p.background?.fill);

describe('a recipe’s dark slides', () => {
  it('puts slides on a default onto the night canvas, new ones too, and keeps a painted one', () => {
    const out = withRecipeSlides(deck([slide('a', steel), slide('b'), slide('c', painted)]), true);
    const night = darkSlideBackground('midnight').fill;
    expect(fills(out)).toEqual([night, night, painted]);
    expect(slidesAreDark(out)).toBe(true);
    const canvas = getBuiltInTheme('midnight', 'dark');
    expect(contrastRatio(canvas.elementText!, canvas.backgroundColor)).toBeGreaterThan(4.5);
  });

  it('brings them back to Steel for another recipe, and leaves a deck it never darkened', () => {
    const dark = withRecipeSlides(deck([slide('a', steel), slide('c', painted)]), true);
    const back = withRecipeSlides(dark, false);
    expect(fills(back)).toEqual([steel, painted]);
    expect(slidesAreDark(back)).toBe(false);
    const plain = deck([slide('a', steel)]);
    expect(withRecipeSlides(plain, false)).toBe(plain);
  });

  it('leaves a tab without slides as it is', () => {
    const doc: Tab = {
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'p', orientation: 'portrait' }],
    };
    expect(withRecipeSlides(doc, true)).toBe(doc);
  });
});
