// Canonical help-centre paths and addresses, apart from any catalogue: a page that only builds links imports this
// and skips the articles. Re-exported from the package root and each app's slice.
//
// A path (`/canvas/themes/`) is the same on every address an article applies to (liveworkspace/docs/specs/016-help/
// help-centre.md "Addresses, canonicals and the old paths"); a scope's address is its app's `www` origin, or
// liveworkspace.app's for All Apps, both under `/help`. The origins are the sites' own (@liveworkspace/sites), so a dev
// server links to the local routers and a build to the live sites.

import { APP_SITES, PLATFORM_SITE, type Site, type SiteId } from '@liveworkspace/sites';
import { inAppOrder, type AppId, type HelpScope } from './apps';
import type { Article } from './types';

/**
 * Canonical in-app path to an article page. Trailing slash to match the help
 * app's `trailingSlash: true` (so internal links resolve directly instead of
 * 308-redirecting). `next/link` prepends the `/help` basePath at render; the
 * sitemap, which needs absolute URLs, prepends the origin + `/help` itself.
 *
 * Given a `scope`, the article's full address on that scope's site instead:
 * `https://www.liveplanner.app/help/tabs/using-tabs/`, for a link that leaves the address the page is on.
 */
export function articleHref(
  article: Pick<Article, 'categorySlug' | 'slug'>,
  scope?: HelpScope,
): string {
  const path = `/${article.categorySlug}/${article.slug}/`;
  return scope ? `${helpUrl(scope)}${path}` : path;
}

/**
 * Canonical in-app path to a category landing page (`/<slug>/`, trailing slash
 * to match `trailingSlash: true`). `slug` is a category slug, top-level
 * (`canvas`) or a nested feature path (`canvas/the-canvas`), both of
 * which have a landing page. Sibling of {@link articleHref}; one source for the
 * category-link shape the cards / breadcrumbs / sitemap built by hand.
 */
export function categoryHref(slug: string): string {
  return `/${slug}/`;
}

const SITE_OF_SCOPE: Record<HelpScope, SiteId> = {
  livediagram: 'livediagram.app',
  liveplanner: 'liveplanner.app',
  livedocuments: 'livedocuments.app',
  livedesign: 'livedesign.app',
  livehuddle: 'livehuddle.app',
  all: 'liveworkspace.app',
};

/** The site a scope's help is shown on: its app's, or liveworkspace.app for All Apps. */
export function siteOfScope(scope: HelpScope): Site {
  const id = SITE_OF_SCOPE[scope];
  if (id === PLATFORM_SITE.id) return PLATFORM_SITE;
  return APP_SITES.find((s) => s.id === id) ?? PLATFORM_SITE;
}

/** A scope's help centre, absolute and without a trailing slash: `https://www.livediagram.app/help`. */
export function helpUrl(scope: HelpScope): string {
  return `${siteOfScope(scope).url}/help`;
}

/** The address of `path` (`/tabs/using-tabs/`, `/` for the home) in a scope's help. */
export function scopeHref(scope: HelpScope, path: string): string {
  return `${helpUrl(scope)}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Whether an article (or anything that names its apps) applies to `scope`: the app switch's "same path or that
 *  app's help home". Under All Apps everything applies. */
export function appliesTo(item: { apps?: readonly AppId[] }, scope: HelpScope): boolean {
  return scope === 'all' || (item.apps ?? []).includes(scope);
}

/**
 * Where a path's one indexable copy lives (help-centre.md "Canonical"): an article for one app on that app's
 * address, an article for two or more on liveworkspace.app. Anything without apps (the home, the contact page) is
 * canonical where it is shown.
 */
export function canonicalScope(item: { apps?: readonly AppId[] }, shownIn: HelpScope): HelpScope {
  const apps = inAppOrder(item.apps ?? []);
  if (apps.length === 0) return shownIn;
  return apps.length === 1 ? apps[0]! : 'all';
}

/** The canonical address of an article: {@link canonicalScope}'s site, at the article's path. */
export function canonicalArticleUrl(article: Pick<Article, 'categorySlug' | 'slug' | 'apps'>): string {
  return articleHref(article, canonicalScope(article, 'all'));
}

/**
 * Where the app switch sends a reader of `path` who picks `target` (help-centre.md "Choosing an app"): the same path
 * on the target's address when the page applies to it (`apps` undefined means it applies everywhere: the home, the
 * contact page), else the target's help home. All Apps always takes the same path.
 */
export function switchHref(
  target: HelpScope,
  path: string,
  apps: readonly AppId[] | undefined,
): string {
  const applies = apps === undefined || appliesTo({ apps }, target);
  return scopeHref(target, applies ? path : '/');
}

/** The longest search a switch link carries (help-centre.md "A search survives the move"). */
export const QUERY_MAX = 200;

/** `href` with the search box's text as `?q=`, trimmed and capped; unchanged when the box is empty. */
export function withQuery(href: string, query: string): string {
  const q = query.trim().slice(0, QUERY_MAX);
  if (!q) return href;
  const hash = href.indexOf('#');
  const base = hash < 0 ? href : href.slice(0, hash);
  const fragment = hash < 0 ? '' : href.slice(hash);
  return `${base}${base.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}${fragment}`;
}
