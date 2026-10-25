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
