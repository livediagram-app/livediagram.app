// The help centre's shared shapes and lookups (liveworkspace/docs/specs/016-help/help-centre.md). The one catalogue
// is its own entry (`@liveworkspace/help-registry/catalogue`) and each app's slice another (`/slice/<app>`), so a
// page that only needs these never loads the articles.

export {
  APP_ORDER,
  appList,
  HELP_SCOPES,
  inAppOrder,
  isAppId,
  isHelpScope,
  SCOPE_WORDS,
  scopeLabel,
  scopeName,
  type AppId,
  type AppWords,
  type HelpScope,
} from './apps';
export {
  appliesTo,
  articleHref,
  canonicalArticleUrl,
  canonicalScope,
  categoryHref,
  helpUrl,
  QUERY_MAX,
  scopeHref,
  siteOfScope,
  switchHref,
  withQuery,
} from './hrefs';
export { createHelpRegistry, rankArticles, type HelpRegistry, type SearchEntry } from './registry';
export {
  allAppsCategories,
  articlesIn,
  inReadingOrder,
  mergeOrders,
  searchIndex,
  withCounts,
  wordedArticle,
  wordedCategory,
  type AllAppsCategory,
  type AppCatalogue,
} from './scope';
export {
  articlePath,
  createHelpTelemetryIds,
  HELP_TELEMETRY_OVERRIDES,
  type HelpTelemetryIds,
} from './telemetry';
export {
  topCategorySlug,
  type Article,
  type ArticleWording,
  type Category,
  type CategoryWording,
} from './types';
