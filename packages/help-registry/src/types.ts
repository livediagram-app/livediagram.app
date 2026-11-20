// The shape of the one help centre's catalogue (liveworkspace/docs/specs/017-help/help-centre.md): the articles and
// categories under src/catalogue/ are in these shapes, and the help app, each app's slice and the editors' search
// read them through the helpers here, so all of them link, group, search and count alike.

import type { AppId } from './apps';

export interface Article {
  slug: string;
  title: string;
  description: string;
  /**
   * Space-separated, lowercase search synonyms. Widens matching beyond the
   * title + description to the vocabulary users actually type: synonyms
   * ("transparency" for opacity), adjacent spellings ("color" next to
   * "colour"), and concept words the copy doesn't happen to use. Every
   * article must have them (enforced by test) so nothing is findable only
   * by its exact title.
   */
  keywords: string;
  category: string;
  /** Full nested path under /help, e.g. "canvas" or "canvas/the-canvas". */
  categorySlug: string;
  /** Feature-landing slug this article hangs off, if it's a sub-article. */
  parentSlug?: string;
  /** Optional sub-category heading used to group a feature category's landing
   *  cards on its index page (e.g. Palette → "Selection Modes" / "Elements" /
   *  "Palette Settings"). Landings without a group render in a single grid. */
  group?: string;
  /** The apps the article applies to, one or more, in registry order (APP_ORDER). An app's help shows only the
   *  articles that apply to it; All Apps shows every one. */
  apps: readonly AppId[];
  /** One app's own wording for the article, where the shared wording reads wrong in that app's help (help-centre.md
   *  "Per-app wording"): its title, description, card group and category name there. Every scope-aware view
   *  (articlesFor, the slices, search, cards, breadcrumbs, metadata) shows the scope's wording; All Apps and the
   *  other apps keep the shared one. */
  byApp?: Partial<Record<AppId, ArticleWording>>;
}

/** An app's wording for an article (Article.byApp): each field replaces the shared one in that app's help. */
export interface ArticleWording {
  title?: string;
  description?: string;
  group?: string;
  category?: string;
}

/** An app's wording for a category (Category.byApp). */
export interface CategoryWording {
  title?: string;
  description?: string;
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  articleCount: number;
  /** Feature-guide categories: grouped under "Feature Guides" on the home page,
   *  apart from the support categories (About, Getting Started, ...). */
  kind?: 'feature';
  /** The order this category's card groups appear in on its page (liveworkspace/docs/specs/017-help/help-centre.md "Groups").
   *  Names every `group` its articles use; without it, groups appear in first-appearance order. */
  groups?: string[];
  /** The apps the category holds articles for: the union of its articles' apps, worked out by categoriesFor (an
   *  authored category leaves it out). */
  apps?: readonly AppId[];
  /** One app's own title and description for the category (Article.byApp's twin): its help shows them, the
   *  other scopes the shared ones. */
  byApp?: Partial<Record<AppId, CategoryWording>>;
}

/**
 * The top-level category a (possibly nested) `categorySlug` belongs to:
 * `palette/tools/data-elements` → `palette`, `canvas` → `canvas`. Lives here
 * because the nested-path shape is the registry's convention, so anything
 * grouping articles by their top-level category (the help centre's per-category
 * icon and accent fallbacks) reads it from one place rather than re-splitting
 * the string and drifting on what a segment means.
 */
export function topCategorySlug(categorySlug: string): string {
  return categorySlug.split('/')[0] ?? '';
}
