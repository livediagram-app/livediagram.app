// The shape of a help centre's catalogue (docs/specs/018-help/help-app.md in each product): every product's
// @<product>/help-registry holds its own articles and categories in these shapes, and the help app and the
// editor's search read them through the helpers here, so all of them link, group, search and count alike.

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
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  articleCount: number;
  /** Feature-guide categories: grouped under "Feature Guides" on the home page,
   *  apart from the support categories (About, Getting Started, ...). */
  kind?: 'feature';
  /** The order this category's card groups appear in on its page (docs/specs/018-help/help-pages.md "Groups").
   *  Names every `group` its articles use; without it, groups appear in first-appearance order. */
  groups?: string[];
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
