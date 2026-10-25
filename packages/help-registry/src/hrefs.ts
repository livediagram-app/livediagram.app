// Canonical help-centre paths, apart from any catalogue: a page that only builds
// links imports this and skips a product's articles. Re-exported from the package root and each product's registry.

import type { Article } from './types';

/**
 * Canonical in-app path to an article page. Trailing slash to match the help
 * app's `trailingSlash: true` (so internal links resolve directly instead of
 * 308-redirecting). `next/link` prepends the `/help` basePath at render; the
 * sitemap, which needs absolute URLs, prepends the origin + `/help` itself.
 * One source for the `/<categorySlug>/<slug>/` shape every card / list / sitemap
 * entry was spelling out by hand.
 */
export function articleHref(article: Pick<Article, 'categorySlug' | 'slug'>): string {
  return `/${article.categorySlug}/${article.slug}/`;
}

/**
 * Canonical in-app path to a category landing page (`/<slug>/`, trailing slash
 * to match `trailingSlash: true`). `slug` is a category slug — top-level
 * (`canvas`) or a nested feature path (`canvas/the-canvas`), both of
 * which have a landing page. Sibling of {@link articleHref}; one source for the
 * category-link shape the cards / breadcrumbs / sitemap built by hand.
 */
export function categoryHref(slug: string): string {
  return `/${slug}/`;
}
