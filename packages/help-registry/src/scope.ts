// A scope's view of the catalogue (liveworkspace/docs/specs/017-help/help-centre.md "Articles and the apps they apply
// to"): the articles that apply to it in its reading order, and its categories with their counts and apps worked out.
// Pure functions over lists, so the whole catalogue (catalogue/index.ts) and each app's slice (slice/<app>.ts) build
// their views the same way from the data they hold.

import { inAppOrder, type AppId, type HelpScope } from './apps';
import { appliesTo } from './hrefs';
import { articlePath } from './telemetry';
import { topCategorySlug, type Article, type Category } from './types';
import type { SearchEntry } from './registry';

/** One app's own part of the catalogue: its categories (its titles and copy) and the articles only it has. */
export interface AppCatalogue {
  articles: readonly Article[];
  categories: readonly Category[];
}

/**
 * `article` as `scope` words it (help-centre.md "Per-app wording"): its `byApp` entry for an app scope replaces the
 * shared title, description, group and category name; All Apps, and an app with no entry, keep the shared wording.
 * The entry stays on the result, so a page can tell its wording was the app's own. Unchanged articles come back as
 * they are (the same object), so lookups by identity still work.
 */
export function wordedArticle(article: Article, scope: HelpScope): Article {
  const own = scope === 'all' ? undefined : article.byApp?.[scope];
  if (!own) return article;
  return {
    ...article,
    ...(own.title !== undefined && { title: own.title }),
    ...(own.description !== undefined && { description: own.description }),
    ...(own.group !== undefined && { group: own.group }),
    ...(own.category !== undefined && { category: own.category }),
  };
}

/** `category` as `scope` words it: Article.byApp's twin for a category's title and description. */
export function wordedCategory(category: Category, scope: HelpScope): Category {
  const own = scope === 'all' ? undefined : category.byApp?.[scope];
  if (!own) return category;
  return {
    ...category,
    ...(own.title !== undefined && { title: own.title }),
    ...(own.description !== undefined && { description: own.description }),
  };
}

/** The articles that apply to `scope`, every article under All Apps. */
export function articlesIn(articles: readonly Article[], scope: HelpScope): Article[] {
  return articles.filter((a) => appliesTo(a, scope));
}

/**
 * Several reading orders as one: the first list as it is, then each next list's paths not yet placed, each put
 * straight after the path it follows in its own list (or first, when it leads its list). Build-time and server-side
 * only: quadratic in the paths, about a thousand.
 */
export function mergeOrders(orders: readonly (readonly string[])[]): string[] {
  const merged: string[] = [];
  for (const order of orders) {
    let after = -1;
    for (const path of order) {
      const at = merged.indexOf(path);
      if (at >= 0) {
        after = at;
        continue;
      }
      merged.splice(after + 1, 0, path);
      after += 1;
    }
  }
  return merged;
}

/** `articles` in `order` (paths, `categorySlug/slug`); an article the order does not list keeps its place after the
 *  listed ones, in the order it came. */
export function inReadingOrder(articles: readonly Article[], order: readonly string[]): Article[] {
  const rank = new Map(order.map((path, i) => [path, i]));
  return articles
    .map((article, i) => ({ article, i, r: rank.get(articlePath(article)) ?? order.length + i }))
    .sort((x, y) => x.r - y.r)
    .map(({ article }) => article);
}

/**
 * Categories as a scope shows them: each with `articleCount`, its direct articles in the scope (those whose
 * categorySlug is exactly its slug, as the help pages count), and `apps`, the apps any article under it applies to
 * across `everyArticle` (so a card can say "All apps" or "3 apps"). Categories keep their given order.
 */
export function withCounts(
  categories: readonly Category[],
  scoped: readonly Article[],
  everyArticle: readonly Article[],
): Category[] {
  const direct = new Map<string, number>();
  for (const a of scoped) direct.set(a.categorySlug, (direct.get(a.categorySlug) ?? 0) + 1);
  const apps = new Map<string, Set<AppId>>();
  for (const a of everyArticle) {
    const top = topCategorySlug(a.categorySlug);
    const set = apps.get(top) ?? new Set<AppId>();
    for (const app of a.apps) set.add(app);
    apps.set(top, set);
  }
  return categories.map((c) => ({
    ...c,
    articleCount: direct.get(c.slug) ?? 0,
    apps: inAppOrder(apps.get(topCategorySlug(c.slug)) ?? []),
  }));
}

/** All Apps' copy for a category: its title and description there, in place of an app's own. */
export interface AllAppsCategory {
  slug: string;
  title: string;
  description: string;
}

/**
 * The categories All Apps shows: every app's, each slug once, in `copy`'s order and then the order the apps list
 * them (registry order), with All Apps' own title and description where `copy` has one. A category any app marks as
 * a feature guide is one; its card groups are every app's groups, in first-listed order.
 */
export function allAppsCategories(
  apps: readonly (readonly Category[])[],
  copy: readonly AllAppsCategory[],
): Category[] {
  const bySlug = new Map<string, Category>();
  for (const list of apps) {
    for (const c of list) {
      const seen = bySlug.get(c.slug);
      if (!seen) {
        bySlug.set(c.slug, { ...c, groups: c.groups ? [...c.groups] : undefined });
        continue;
      }
      if (c.kind === 'feature') seen.kind = 'feature';
      if (c.groups) {
        const groups = seen.groups ?? [];
        for (const g of c.groups) if (!groups.includes(g)) groups.push(g);
        seen.groups = groups;
      }
    }
  }
  const ordered: Category[] = [];
  for (const entry of copy) {
    const found = bySlug.get(entry.slug);
    if (!found) continue;
    ordered.push({ ...found, title: entry.title, description: entry.description });
    bySlug.delete(entry.slug);
  }
  return [...ordered, ...bySlug.values()];
}

/**
 * The search box's index for `scope` (help-centre.md "Search"): only the fields a result row, its group and its link
 * read, in the scope's wording. An app's help loads its own index first and All Apps' (`scope` `all`) only when the
 * "From Other Apps" group is wanted, so a reader in one app never downloads the other apps' articles up front. In
 * the All Apps index an article for one app keeps that app's wording, since its link opens it there.
 */
export function searchIndex(articles: readonly Article[], scope: HelpScope): SearchEntry[] {
  return articles.map((article) => {
    const worded =
      scope === 'all' && article.apps.length === 1
        ? wordedArticle(article, article.apps[0]!)
        : wordedArticle(article, scope);
    return {
      slug: worded.slug,
      title: worded.title,
      description: worded.description,
      keywords: worded.keywords,
      category: worded.category,
      categorySlug: worded.categorySlug,
      apps: [...worded.apps],
    };
  });
}
