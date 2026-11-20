// livediagram's slice of the one help catalogue (./make.ts): what @livediagram/help-registry exports,
// under the names its help registry always had, for its editor's search panel, CLI and MCP.

import * as own from '../catalogue/livediagram';
import { ORDER } from '../catalogue/order/livediagram';
import { sharedArticles } from '../catalogue/shared';
import { createSlice } from './make';

export { articleHref, categoryHref } from '../hrefs';
export { COMMUNITY_HELP, type CommunityHelpArticle } from '../community';
export { articlePath } from '../telemetry';
export { topCategorySlug, type Article, type Category } from '../types';

export const {
  articles,
  categories,
  featureCategories,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
  searchArticles,
  TELEMETRY_ID_OVERRIDES,
  articleTelemetryId,
  helpPathTelemetryId,
} = /* @__PURE__ */ createSlice('livediagram', own, sharedArticles, ORDER);
