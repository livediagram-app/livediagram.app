// The telemetry identifier of a help article (docs/specs/017-telemetry/telemetry.md `Help`,
// docs/specs/018-help/contextual-help-links.md in each product).
//
// Help telemetry reports WHICH article was read, voted on, or opened from the
// editor, as the event's `type`. That has to be a bounded token
// (TELEMETRY_TYPE_PATTERN: no `/`), so it can't be the article's nested path,
// and it used to be the path's last segment. Where two articles share a last
// segment (livediagram's Tips and Tricks has its own Format Painter and Palette
// write-ups beside the feature articles), each pair reported one merged number.
//
// The identifier is the article's `slug`, except for the articles a product lists
// in its overrides, which get a distinct token. The feature article keeps the
// plain slug, so every row stored before a split still names the article it
// mostly meant, and the other copy starts a new series. A test in each product's
// apps/help fails if two articles ever resolve to the same id, so a new collision
// has to be resolved in that product's overrides, explicitly, rather than silently
// merging (an automatic rule would instead RENAME an existing article's series the
// day a colliding article was added).
//
// No catalogue here: every help page sends an id, and a registry lookup would put
// the whole catalogue in each page's JavaScript.

import type { AppId } from './apps';
import type { Article } from './types';

/** An article's full path under /help, e.g. `selection-modes/format-painter`. */
export function articlePath(article: Pick<Article, 'categorySlug' | 'slug'>): string {
  return `${article.categorySlug}/${article.slug}`;
}

export type HelpTelemetryIds = {
  /** The telemetry `type` for one registry article. */
  articleTelemetryId: (article: Pick<Article, 'categorySlug' | 'slug'>) => string;
  /**
   * The telemetry `type` for a help path (`/palette/format-painter/`, with or
   * without slashes at either end). A registry article resolves to its
   * articleTelemetryId; anything else (a category landing page such as
   * `palette`) falls back to its last segment. The editor's help-link test
   * checks every path it links still resolves to a distinct id.
   *
   * Worked out from the path alone, never by finding the article: an article's
   * path ends in its slug, so its override or last segment IS its id (a test in
   * apps/help holds that for every article).
   */
  helpPathTelemetryId: (path: string) => string;
};

/**
 * A product's help telemetry ids, from its overrides: explicit tokens for articles whose slug another article
 * already uses, keyed by the article's full path (`categorySlug/slug`). Never rename a value: it is the stored
 * series name on the public dashboard.
 */
export function createHelpTelemetryIds(
  overrides: Readonly<Record<string, string>>,
): HelpTelemetryIds {
  return {
    articleTelemetryId: (article) => overrides[articlePath(article)] ?? article.slug,
    helpPathTelemetryId: (path) => {
      const clean = path.split('/').filter(Boolean).join('/');
      return overrides[clean] ?? clean.slice(clean.lastIndexOf('/') + 1);
    },
  };
}

/**
 * Each app's overrides (above), the one copy: tokens for articles whose slug another article of the same app's help
 * already uses, keyed by the article's path. The one help centre reads the scope's (All Apps: every app's at once,
 * since a path means one article whichever app's help shows it); each app's slice exports its own.
 */
export const HELP_TELEMETRY_OVERRIDES: Readonly<Record<AppId, Readonly<Record<string, string>>>> = {
  livediagram: {
    'tips-and-tricks/format-painter': 'tips-format-painter',
    'tips-and-tricks/command-palette': 'tips-command-palette',
  },
  liveplanner: {
    'tips-and-tricks/command-palette': 'tips-command-palette',
  },
  livedocuments: {
    'tips-and-tricks/format-painter': 'tips-format-painter',
    'tips-and-tricks/command-palette': 'tips-command-palette',
  },
  livedesign: {
    'tips-and-tricks/format-painter': 'tips-format-painter',
    'tips-and-tricks/command-palette': 'tips-command-palette',
  },
  livehuddle: {
    'tips-and-tricks/format-painter': 'tips-format-painter',
    'tips-and-tricks/command-palette': 'tips-command-palette',
  },
  // liveknowledge shows neither Tips copy, so no two of its articles share a slug.
  liveknowledge: {},
};
