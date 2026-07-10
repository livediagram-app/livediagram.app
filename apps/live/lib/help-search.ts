// The help-centre catalogue surfaced by the global SearchPanel (spec/09 +
// spec/56): the FULL article registry from @livediagram/help-registry, so
// every help article is findable from the canvas. Each item matches on its
// title plus the registry's description + keyword synonyms ("transparency"
// finds Layer Order and Opacity), resolved to an absolute /help href.
//
// Deep links from editor surfaces (HelpArticleLink etc.) still go through the
// symbolic-key map in help-articles.ts; this module only feeds search.

import { articleHref, articles } from '@livediagram/help-registry';
import type { HelpSearchItem } from './search';

/** The built help catalogue passed to the SearchPanel. Static, so built once. */
export const HELP_SEARCH_ITEMS: HelpSearchItem[] = articles.map((a) => ({
  id: `help:${a.categorySlug}/${a.slug}`,
  title: a.title,
  keywords: `${a.description} ${a.keywords}`,
  // articleHref is basePath-relative (the help app prepends /help at render);
  // the editor links cross-app, so it prepends /help itself.
  href: `/help${articleHref(a)}`,
  // The slash-free slug doubles as the telemetry `type` on click, matching
  // help-articles.ts's helpArticleLeaf convention.
  leaf: a.slug,
}));
