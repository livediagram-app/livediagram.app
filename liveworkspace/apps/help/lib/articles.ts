// The build's scope's view of the one catalogue (packages/help-registry/src/catalogue), under the names every page
// imports from `@/lib/articles`: its articles in reading order, its categories with their counts, and the registry's
// lookups over them. `searchArticles` searches the scope; the search box fetches its own indexes instead
// (app/search-index.json, app/search-all.json).
import { catalogueFor, searchArticles as searchAll } from '@liveworkspace/help-registry/catalogue';
import type { Article } from '@liveworkspace/help-registry';
import { SCOPE } from './scope.generated';

export * from '@liveworkspace/help-registry';

export const {
  articles,
  categories,
  featureCategories,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
} = catalogueFor(SCOPE);

/** The scope's articles that match `query`, best first. */
export function searchArticles(query: string): Article[] {
  return searchAll(query, SCOPE);
}
