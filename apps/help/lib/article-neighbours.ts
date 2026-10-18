import {
  articleHref,
  articles,
  categories,
  categoryHref,
  getCategoryGroups,
  topCategorySlug,
  type Article,
} from '@/lib/articles';

// An article page's place in its reading order (docs/specs/018-help/help-pages.md "Article pages"). Server-side
// only: it reads the whole registry, and hands the article page just the few links it shows.

/** A link the article page shows: a title and where it goes. */
export interface ArticleLink {
  title: string;
  href: string;
}

const byTitle = new Map(articles.map((a) => [a.title, a]));

/** The registry article an article page is, found by its title (titles are unique, meta-descriptions.test.ts). */
export function articleByTitle(title: string): Article | undefined {
  return byTitle.get(title);
}

/** The articles beside `article` in its reading order: the order its own listing page shows its siblings in. */
export function articleNeighbours(article: Article): { prev?: Article; next?: Article } {
  const order = getCategoryGroups(article.categorySlug).flatMap((g) => g.articles);
  const i = order.indexOf(article);
  if (i < 0) return {};
  return { prev: order[i - 1], next: order[i + 1] };
}

/** The top-level category an article belongs to, as the link its page's eyebrow shows. */
export function articleCategoryLink(article: Article): ArticleLink | undefined {
  const slug = topCategorySlug(article.categorySlug);
  const category = categories.find((c) => c.slug === slug);
  return category ? { title: category.title, href: categoryHref(category.slug) } : undefined;
}

export function articleLink(article: Article): ArticleLink {
  return { title: article.title, href: articleHref(article) };
}
