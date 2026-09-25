// The telemetry identifier of a help article (spec/22 `Help`, spec/56).
//
// Help telemetry reports WHICH article was read, voted on, or opened from the
// editor, as the event's `type`. That has to be a bounded token
// (TELEMETRY_TYPE_PATTERN: no `/`), so it can't be the article's nested path,
// and it used to be the path's last segment. Two pairs of articles share a last
// segment (Tips and Tricks has its own Format Painter and Palette write-ups
// beside the feature articles), so each pair reported one merged number.
//
// The identifier is the article's `slug`, except for the articles listed in
// TELEMETRY_ID_OVERRIDES, which get a distinct token. The feature article keeps
// the plain slug, so every row stored before the split still names the
// article it mostly meant, and the Tips and Tricks copy starts a new series.
// A test in apps/help fails if two articles ever resolve to the same id, so a
// new collision has to be resolved here, explicitly, rather than silently
// merging (an automatic rule would instead RENAME an existing article's
// series the day a colliding article was added).

import { articles, type Article } from './index';

/**
 * Explicit tokens for articles whose slug another article already uses,
 * keyed by the article's full path (`categorySlug/slug`). Never rename a
 * value: it is the stored series name on the public dashboard.
 */
export const TELEMETRY_ID_OVERRIDES: Readonly<Record<string, string>> = {
  'tips-and-tricks/format-painter': 'tips-format-painter',
  'tips-and-tricks/command-palette': 'tips-command-palette',
};

/** An article's full path under /help, e.g. `selection-modes/format-painter`. */
export function articlePath(article: Pick<Article, 'categorySlug' | 'slug'>): string {
  return `${article.categorySlug}/${article.slug}`;
}

/** The telemetry `type` for one registry article. */
export function articleTelemetryId(article: Pick<Article, 'categorySlug' | 'slug'>): string {
  return TELEMETRY_ID_OVERRIDES[articlePath(article)] ?? article.slug;
}

/**
 * The telemetry `type` for a help path (`/palette/format-painter/`, with or
 * without slashes at either end). A registry article resolves to its
 * {@link articleTelemetryId}; anything else (a category landing page such as
 * `palette`) falls back to its last segment. The editor's help-link test
 * checks every path it links still resolves to a distinct id.
 */
export function helpPathTelemetryId(path: string): string {
  const clean = path.split('/').filter(Boolean).join('/');
  const article = articles.find((a) => articlePath(a) === clean);
  if (article) return articleTelemetryId(article);
  return clean.slice(clean.lastIndexOf('/') + 1);
}
