import { describe, expect, it } from 'vitest';
import { articles, categories } from './articles';

// `articleCount` is hand-maintained (docs/specs/018-help/help-app.md), and a stale one is invisible:
// the category card simply advertises the wrong number, and nothing at
// runtime can notice. This pins the rule it actually follows — every article
// whose `categorySlug` is exactly this category, sub-articles included — so
// the next person to add an article gets told, rather than guessing from the
// other entries.
describe('category articleCount', () => {
  it('matches the articles registered under each category', () => {
    const wrong = categories
      .map((c) => {
        const actual = articles.filter((a) => a.categorySlug === c.slug).length;
        return actual === c.articleCount
          ? null
          : `${c.slug}: says ${c.articleCount}, has ${actual}`;
      })
      .filter(Boolean);
    expect(wrong).toEqual([]);
  });

  it('every article sits in a category that exists', () => {
    const slugs = new Set(categories.map((c) => c.slug));
    const orphans = articles
      .filter((a) => !slugs.has(a.categorySlug.split('/')[0]!))
      .map((a) => `${a.slug} -> ${a.categorySlug}`);
    expect(orphans).toEqual([]);
  });

  it('every sub-article names a parent that exists', () => {
    // A parent is either another ARTICLE (Layers -> Hiding and Locking) or
    // the CATEGORY's own landing page (About -> Who is it for), which is a
    // page in its own right rather than a registry entry.
    const known = new Set([...articles.map((a) => a.slug), ...categories.map((c) => c.slug)]);
    const dangling = articles
      .filter((a) => a.parentSlug && !known.has(a.parentSlug))
      .map((a) => `${a.slug} -> ${a.parentSlug}`);
    expect(dangling).toEqual([]);
  });
});
