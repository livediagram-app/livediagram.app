// One app's slice of the catalogue (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The catalogue"):
// the articles that apply to the app, in its reading order, its categories with their counts, and the lookups over
// them, under the names each app's own help registry exported before the merge. Its editor's search panel, CLI and
// MCP read it through @<app>/help-registry, so they never bundle the other apps' own articles.

import type { AppId } from '../apps';
import { createHelpRegistry } from '../registry';
import {
  articlesIn,
  inReadingOrder,
  withCounts,
  wordedArticle,
  wordedCategory,
  type AppCatalogue,
} from '../scope';
import { createHelpTelemetryIds, HELP_TELEMETRY_OVERRIDES } from '../telemetry';

export function createSlice(
  app: AppId,
  own: AppCatalogue,
  shared: AppCatalogue['articles'],
  order: readonly string[],
) {
  const every = [...own.articles, ...shared];
  // In the app's own wording (Article.byApp), as its help shows them, so the editor's search panel reads the same.
  const articles = inReadingOrder(articlesIn(every, app), order).map((a) => wordedArticle(a, app));
  const categories = withCounts(own.categories, articles, every).map((c) => wordedCategory(c, app));
  const TELEMETRY_ID_OVERRIDES = HELP_TELEMETRY_OVERRIDES[app];
  return {
    articles,
    categories,
    ...createHelpRegistry(categories, articles),
    TELEMETRY_ID_OVERRIDES,
    ...createHelpTelemetryIds(TELEMETRY_ID_OVERRIDES),
  };
}
