import { describe, expect, it } from 'vitest';
import { articles, getCategoryGroups } from '@/lib/articles';
import { articleByTitle, articleCategoryLink, articleNeighbours } from './article-neighbours';

// docs/specs/018-help/help-pages.md "Article pages": an article's previous and next are its neighbours in the order
// its listing page shows, and every article page finds itself in the registry.
describe('article neighbours', () => {
  it('finds every article by its title', () => {
    for (const a of articles) expect(articleByTitle(a.title)).toBe(a);
    expect(articleByTitle('No Such Article')).toBeUndefined();
  });

  it('links each article to the next one and back again', () => {
    for (const a of articles) {
      const { prev, next } = articleNeighbours(a);
      if (next) expect(articleNeighbours(next).prev).toBe(a);
      if (prev) expect(articleNeighbours(prev).next).toBe(a);
    }
  });

  it('follows the order the category page shows, groups included', () => {
    const shown = getCategoryGroups('plan').flatMap((g) => g.articles);
    expect(articleNeighbours(shown[0]!).prev).toBeUndefined();
    expect(articleNeighbours(shown[0]!).next).toBe(shown[1]);
    expect(articleNeighbours(shown.at(-1)!).next).toBeUndefined();
    // Crossing from one group into the next.
    const groups = getCategoryGroups('plan');
    const lastOfFirst = groups[0]!.articles.at(-1)!;
    expect(articleNeighbours(lastOfFirst).next).toBe(groups[1]!.articles[0]);
  });

  it('names the top-level category of a nested article', () => {
    const nested = articles.find((a) => a.categorySlug.includes('/'))!;
    expect(articleCategoryLink(nested)?.href).toBe(`/${nested.categorySlug.split('/')[0]}/`);
  });
});
