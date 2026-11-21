// liveknowledge's slice of the one help catalogue (./make.ts): what @liveknowledge/help-registry exports, for its
// editor's search panel, CLI and MCP.

import * as own from '../catalogue/liveknowledge';
import { ORDER } from '../catalogue/order/liveknowledge';
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
} = /* @__PURE__ */ createSlice('liveknowledge', own, sharedArticles, ORDER);
