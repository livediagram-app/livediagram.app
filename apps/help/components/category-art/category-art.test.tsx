import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { categories } from '@/lib/articles';
import { CATEGORY_ART, CategoryArt } from './index';

// docs/specs/018-help/help-pages.md "Category art": every category with a card has its own scene, and every scene
// is decorative art on the help-art stage (so the dark appearance reaches it).
const withCards = categories.filter((c) => c.slug !== 'contact');

describe('category art', () => {
  it('gives every category with a card its own scene, and no scene to a category that does not exist', () => {
    expect(Object.keys(CATEGORY_ART).sort()).toEqual(withCards.map((c) => c.slug).sort());
    expect(new Set(Object.values(CATEGORY_ART)).size).toBe(withCards.length);
  });

  it.each(withCards.map((c) => c.slug))(
    '%s draws on the stage, hidden from assistive tech',
    (slug) => {
      const html = renderToStaticMarkup(<CategoryArt slug={slug} />);
      expect(html).toMatch(/^<svg[^>]*class="help-art /);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('viewBox="0 0 400 220"');
    },
  );

  it('renders nothing for a slug without a scene', () => {
    expect(renderToStaticMarkup(<CategoryArt slug="contact" />)).toBe('');
  });
});
