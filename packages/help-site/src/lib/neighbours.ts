import {
  articleHref,
  categoryHref,
  topCategorySlug,
  type Article,
} from '@liveworkspace/help-registry';
import type { ArticleLink, HelpCatalogue } from '../types';

// An article page's place in its reading order (docs/specs/018-help/help-pages.md "Article pages"). Server-side
// only: it reads the whole registry, and hands the article page just the few links it shows.

export interface ArticleNeighbours {
  /** The registry article an article page is, found by its title (titles are unique, meta-descriptions.test.ts). */
  articleByTitle: (title: string) => Article | undefined;
  /** The articles beside `article` in its reading order: the order its own listing page shows its siblings in. */
  articleNeighbours: (article: Article) => { prev?: Article; next?: Article };
  /** The top-level category an article belongs to, as the link its page's eyebrow shows. */
  articleCategoryLink: (article: Article) => ArticleLink | undefined;
}

export function createArticleNeighbours({
  articles,
  categories,
  getCategoryGroups,
}: HelpCatalogue): ArticleNeighbours {
  const byTitle = new Map(articles.map((a) => [a.title, a]));
  return {
    articleByTitle: (title) => byTitle.get(title),
    articleNeighbours: (article) => {
      const order = getCategoryGroups(article.categorySlug).flatMap((g) => g.articles);
      const i = order.indexOf(article);
      if (i < 0) return {};
      return { prev: order[i - 1], next: order[i + 1] };
    },
    articleCategoryLink: (article) => {
      const slug = topCategorySlug(article.categorySlug);
      const category = categories.find((c) => c.slug === slug);
      return category ? { title: category.title, href: categoryHref(category.slug) } : undefined;
    },
  };
}

export function articleLink(article: Article): ArticleLink {
  return { title: article.title, href: articleHref(article) };
}
