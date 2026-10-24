// The lookups over one product's help catalogue: what its help app browses and searches, and what the editor's
// search panel ranks. A product builds them once from its own articles and categories (createHelpRegistry) in
// @<product>/help-registry and exports the result, so its catalogue stays its own data and the lookups stay one copy.

import type { Article, Category } from './types';

export type HelpRegistry = {
  /** The feature-guide categories, in catalogue order. */
  featureCategories: Category[];
  getArticlesByCategory: (categorySlug: string) => Article[];
  getCategoryGroups: (categorySlug: string) => { group: string; articles: Article[] }[];
  getSubArticles: (parentSlug: string) => Article[];
  searchArticles: (query: string) => Article[];
};

export function createHelpRegistry(
  categories: readonly Category[],
  articles: readonly Article[],
): HelpRegistry {
  const getArticlesByCategory = (categorySlug: string): Article[] =>
    articles.filter((a) => a.categorySlug === categorySlug);

  /**
   * A feature category's landing cards, split into sub-category groups in the
   * category's `groups` order, else the order each group first appears in the articles. Used by the category
   * index to render grouped sections (e.g. Palette's Selection Modes / Elements
   * / Palette Settings). A category whose landings have no `group` collapses to
   * a single section with an empty `group` label, so callers can render a plain
   * grid unchanged.
   */
  const getCategoryGroups = (categorySlug: string): { group: string; articles: Article[] }[] => {
    const items = getArticlesByCategory(categorySlug);
    const groups: { group: string; articles: Article[] }[] = [];
    for (const article of items) {
      const label = article.group ?? '';
      const existing = groups.find((g) => g.group === label);
      if (existing) existing.articles.push(article);
      else groups.push({ group: label, articles: [article] });
    }
    // A category may fix its groups' order; a group it does not name keeps its place after the named ones.
    const order = categories.find((c) => c.slug === categorySlug)?.groups ?? [];
    const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length);
    return groups.sort((a, b) => rank(a.group) - rank(b.group));
  };

  const getSubArticles = (parentSlug: string): Article[] =>
    articles.filter((a) => a.parentSlug === parentSlug);

  /**
   * The articles matching `query` (case-insensitive, on title, description and keywords), best first: a title that
   * starts with the query, then a title with a word starting with it, then a title containing it, then a match in
   * the description, then one in the keywords alone, then (for a query of several words) an article holding every
   * word somewhere across the three, those with more of the words in the title first: "export png" finds Exporting
   * Diagrams. Catalogue order breaks ties.
   */
  const searchArticles = (query: string): Article[] => {
    const lower = query.toLowerCase().trim();
    const words = lower.split(/\s+/).filter(Boolean);
    // Ranks 5 and up: every word found across the three fields, fewer of them outside the title ranking higher.
    const rank = (a: Article): number => {
      const title = a.title.toLowerCase();
      if (title.startsWith(lower)) return 0;
      if (title.includes(` ${lower}`)) return 1;
      if (title.includes(lower)) return 2;
      if (a.description.toLowerCase().includes(lower)) return 3;
      if (a.keywords.toLowerCase().includes(lower)) return 4;
      if (words.length < 2) return -1;
      const hay = `${title} ${a.description} ${a.keywords}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return -1;
      return 5 + words.filter((w) => !title.includes(w)).length;
    };
    return articles
      .map((a) => ({ a, r: rank(a) }))
      .filter(({ r }) => r >= 0)
      .sort((x, y) => x.r - y.r)
      .map(({ a }) => a);
  };

  return {
    featureCategories: categories.filter((c) => c.kind === 'feature'),
    getArticlesByCategory,
    getCategoryGroups,
    getSubArticles,
    searchArticles,
  };
}
