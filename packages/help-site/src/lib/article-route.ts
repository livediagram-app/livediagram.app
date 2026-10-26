// An article's own URL and its parent's, read off the route it is served at
// (docs/specs/018-help/help-app.md "SEO"). The help centre nests sub-articles
// under their parent's folder (`palette/tools/data-elements/legend/` sits
// under `palette/tools/data-elements/`), so the route already says where the
// parent lives. The page props cannot: `categorySlug` is sometimes the top
// category (`palette`) and sometimes the parent's own path, and building the
// parent link from it sent breadcrumbs to pages that do not exist
// (`/help/palette/data-elements/`) and the TechArticle url to the category.

// `usePathname()` without the basePath, normalised to the trailing slash the
// help app serves (`trailingSlash: true`). `/` stays `/`.
export function routeHref(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : `${trimmed}/`;
}

// The route one level up: the parent article (or the category landing a
// top-level article hangs off). The help home is its own parent.
export function parentRouteHref(pathname: string): string {
  const segments = routeHref(pathname).split('/').filter(Boolean);
  return routeHref(`/${segments.slice(0, -1).join('/')}`);
}

export type Crumb = { label: string; href?: string };

// An article's breadcrumb trail below Help, read off the route like its links above: the top category (the
// route's first segment), the parent article one level up when there is one, then the article itself. The
// category is skipped when it would repeat the title or the parent. The category crumb had been built from
// `categorySlug`, which for a nested article is the parent's path: it linked "Developers" to the parent's page
// (two crumbs, one URL) and, with no parent passed, labelled the parent's page with the category's name.
export function articleCrumbs({
  pathname,
  title,
  categoryTitle,
  parentTitle,
}: {
  pathname: string;
  title: string;
  categoryTitle: string;
  parentTitle?: string;
}): Crumb[] {
  const segments = routeHref(pathname).split('/').filter(Boolean);
  const categoryHref = routeHref(`/${segments[0] ?? ''}`);
  const parentHref = parentRouteHref(pathname);
  const parent =
    parentTitle && segments.length > 2 && parentHref !== categoryHref
      ? { label: parentTitle, href: parentHref }
      : null;
  const showCategory =
    segments.length > 1 && categoryTitle !== title && categoryTitle !== parent?.label;
  return [
    ...(showCategory ? [{ label: categoryTitle, href: categoryHref }] : []),
    ...(parent ? [parent] : []),
    { label: title },
  ];
}
