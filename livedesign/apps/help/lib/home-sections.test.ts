import { describe, expect, it } from 'vitest';
import { articles, categories } from '@/lib/articles';
import { homeCategorySlugs, HOME_SECTIONS, POPULAR_TOPICS } from './home-sections';

// docs/specs/018-help/help-pages.md "Home page": every category appears on the home page exactly once, and every
// popular topic is a real article.
describe('home page sections', () => {
  it('shows every category exactly once', () => {
    const shown = homeCategorySlugs();
    expect([...shown].sort()).toEqual(categories.map((c) => c.slug).sort());
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('puts only feature categories under Editor Guides', () => {
    const editor = HOME_SECTIONS.find((s) => s.id === 'editor-guides')!;
    const features = categories.filter((c) => c.kind === 'feature').map((c) => c.slug);
    expect([...editor.categories].sort()).toEqual([...features].sort());
  });

  it.each(POPULAR_TOPICS.map((t) => [t.label, t.path]))(
    'popular topic %s names a real article',
    (_, path) => {
      expect(articles.some((a) => `${a.categorySlug}/${a.slug}` === path)).toBe(true);
    },
  );
});
