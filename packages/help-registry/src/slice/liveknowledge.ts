// liveknowledge's slice of the one help catalogue (./make.ts): what @liveknowledge/help-registry exports, for its
// editor's search panel, CLI and MCP.
//
// An interim slice (liveknowledge/docs/specs/016-platform/platform-registration.md "Help centre"): liveknowledge is
// not a help scope yet (no AppId, no edition, no articles of its own), and it was forked from livedocuments with the
// same features, so its slice is livedocuments' articles and categories, in livedocuments' reading order and
// wording, with the product's name swapped in the words people read. The paths are unchanged, and on
// liveknowledge.app/help the help centre's Worker answers them from All Apps (it knows no `liveknowledge` scope).
// When liveknowledge becomes a scope this file becomes `createSlice('liveknowledge', own, sharedArticles, ORDER)` like
// its siblings.

import * as documents from '../catalogue/livedocuments';
import { ORDER } from '../catalogue/order/livedocuments';
import { sharedArticles } from '../catalogue/shared';
import { createHelpRegistry } from '../registry';
import type { Article, Category } from '../types';
import { createSlice } from './make';

export { articleHref, categoryHref } from '../hrefs';
export { COMMUNITY_HELP, type CommunityHelpArticle } from '../community';
export { articlePath } from '../telemetry';
export { topCategorySlug, type Article, type Category } from '../types';

/** `text` with livedocuments' name read as liveknowledge's (its possessive takes the s: liveknowledge’s). */
export function renamed(text: string): string {
  return text
    .replace(/livedocuments(’|')(?!s)/g, 'liveknowledge$1s')
    .replaceAll('livedocuments', 'liveknowledge');
}

const article = (a: Article): Article => ({
  ...a,
  title: renamed(a.title),
  description: renamed(a.description),
  keywords: renamed(a.keywords),
  category: renamed(a.category),
  ...(a.group !== undefined && { group: renamed(a.group) }),
});
const category = (c: Category): Category => ({
  ...c,
  title: renamed(c.title),
  description: renamed(c.description),
});

// livedocuments' slice, as its help words it (Article.byApp), then the name swapped in what people read.
const documentsSlice = /* @__PURE__ */ createSlice(
  'livedocuments',
  documents,
  sharedArticles,
  ORDER,
);

export const articles: Article[] = /* @__PURE__ */ documentsSlice.articles.map(article);
export const categories: Category[] = /* @__PURE__ */ documentsSlice.categories.map(category);

export const {
  featureCategories,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
  searchArticles,
} = /* @__PURE__ */ createHelpRegistry(categories, articles);

export const { TELEMETRY_ID_OVERRIDES, articleTelemetryId, helpPathTelemetryId } = documentsSlice;
