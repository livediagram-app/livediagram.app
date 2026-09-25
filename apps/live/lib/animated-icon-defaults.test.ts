import { describe, expect, it } from 'vitest';
import { defaultIconAnimation } from '@livediagram/diagram';
import { ICON_CATEGORIES } from './icons';

// The palette has a category called Animated, and its icons are the ones drawn
// to move (spec/09). Adding a fifth glyph there without a default animation
// would give the user a static "animated" icon, which is the state this change
// existed to fix; the check is here because the category list is what defines
// the set, while the defaults live in the diagram package.

const animated = ICON_CATEGORIES.find((c) => c.id === 'animated')!;

describe('animated icon defaults', () => {
  it('covers every icon in the Animated category', () => {
    expect(animated.iconIds.length).toBeGreaterThan(0);
    for (const id of animated.iconIds) expect(defaultIconAnimation(id)).toBeDefined();
  });

  it('leaves the rest of the palette static', () => {
    for (const category of ICON_CATEGORIES) {
      if (category.id === 'animated') continue;
      for (const id of category.iconIds) expect(defaultIconAnimation(id)).toBeUndefined();
    }
  });
});
