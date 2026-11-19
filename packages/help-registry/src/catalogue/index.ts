// The one catalogue (liveworkspace/docs/specs/016-help/help-centre.md): every app's own articles and categories
// (./<app>.ts), the articles the apps share (./shared), All Apps' category copy (./all.ts) and each app's reading
// order (./order), put together once, with the views each scope reads. The help centre imports this; an editor
// imports its app's slice (../slice/<app>.ts) instead, so it never bundles the other apps' entries.

import { APP_ORDER, type AppId, type HelpScope } from '../apps';
import { createHelpRegistry, rankArticles, type HelpRegistry } from '../registry';
import {
  allAppsCategories,
  articlesIn,
  inReadingOrder,
  mergeOrders,
  searchIndex,
  withCounts,
  wordedArticle,
  wordedCategory,
  type AppCatalogue,
} from '../scope';
import type { SearchEntry } from '../registry';
import type { Article, Category } from '../types';
import { ALL_APPS_CATEGORIES } from './all';

export { ALL_APPS_CATEGORIES } from './all';
import * as livedesign from './livedesign';
import * as livediagram from './livediagram';
import * as livedocuments from './livedocuments';
import * as livehuddle from './livehuddle';
import * as liveplanner from './liveplanner';
import { ORDER as livedesignOrder } from './order/livedesign';
import { ORDER as livediagramOrder } from './order/livediagram';
import { ORDER as livedocumentsOrder } from './order/livedocuments';
import { ORDER as livehuddleOrder } from './order/livehuddle';
import { ORDER as liveplannerOrder } from './order/liveplanner';
import { sharedArticles } from './shared';

export { HELP_REDIRECTS, redirectFor, type HelpRedirect } from './redirects';

/** Each app's own part: its categories and the articles only it has. */
export const APP_CATALOGUES: Record<AppId, AppCatalogue> = {
  livediagram,
  liveplanner,
  livedocuments,
  livedesign,
  livehuddle,
};

/** Each app's reading order, by article path. */
export const APP_READING_ORDERS: Record<AppId, readonly string[]> = {
  livediagram: livediagramOrder,
  liveplanner: liveplannerOrder,
  livedocuments: livedocumentsOrder,
  livedesign: livedesignOrder,
  livehuddle: livehuddleOrder,
};

/** Every article, each path once, in All Apps' reading order (the apps' orders merged in registry order). */
export const allArticles: readonly Article[] = inReadingOrder(
  [...APP_ORDER.flatMap((app) => APP_CATALOGUES[app].articles), ...sharedArticles],
  mergeOrders(APP_ORDER.map((app) => APP_READING_ORDERS[app])),
);

/** The articles that apply to `scope`, in its reading order and its wording (Article.byApp). */
export function articlesFor(scope: HelpScope): Article[] {
  if (scope === 'all') return [...allArticles];
  return inReadingOrder(articlesIn(allArticles, scope), APP_READING_ORDERS[scope]).map((a) =>
    wordedArticle(a, scope),
  );
}

/** The categories `scope` shows: the app's own (its titles and copy), or All Apps' list, each with its counts in the
 *  scope and the apps it holds articles for. */
export function categoriesFor(scope: HelpScope): Category[] {
  const defs =
    scope === 'all'
      ? allAppsCategories(
          APP_ORDER.map((app) => APP_CATALOGUES[app].categories),
          ALL_APPS_CATEGORIES,
        )
      : APP_CATALOGUES[scope].categories;
  return withCounts(defs, articlesFor(scope), allArticles).map((c) => wordedCategory(c, scope));
}

/** The articles matching `query` that apply to `scope`, best first (the registry's ranking). */
export function searchArticles(query: string, scope: HelpScope): Article[] {
  return rankArticles(articlesFor(scope), query);
}

/** The search box's index for `scope` (scope.ts searchIndex): an app's articles in its wording, or every article
 *  under All Apps. The help app serves each as a static JSON file the box fetches on first use. */
export function searchIndexFor(scope: HelpScope): SearchEntry[] {
  return searchIndex(scope === 'all' ? allArticles : articlesIn(allArticles, scope), scope);
}

/** A scope's catalogue and its lookups, worked out once per scope. */
export interface ScopeCatalogue extends HelpRegistry {
  scope: HelpScope;
  articles: Article[];
  categories: Category[];
}

const scopes = new Map<HelpScope, ScopeCatalogue>();

/** The scope's articles, categories and lookups: what a help build for that scope browses. */
export function catalogueFor(scope: HelpScope): ScopeCatalogue {
  const known = scopes.get(scope);
  if (known) return known;
  const articles = articlesFor(scope);
  const categories = categoriesFor(scope);
  const made = { scope, articles, categories, ...createHelpRegistry(categories, articles) };
  scopes.set(scope, made);
  return made;
}

/** How many articles each scope shows: the app switch's guide counts. */
export function guideCounts(): Record<HelpScope, number> {
  const counts = { all: allArticles.length } as Record<HelpScope, number>;
  for (const app of APP_ORDER) counts[app] = articlesIn(allArticles, app).length;
  return counts;
}
