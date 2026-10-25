// One crumb of a BreadcrumbList. `url` is absolute; a crumb without one (the
// current page, when the trail doesn't link it) is emitted without an `item`.
export type BreadcrumbCrumb = { name: string; url?: string };

// schema.org BreadcrumbList for a trail, root first. Positions are 1-based
// and assigned here so callers can't drift on them; render the result with
// <JsonLd>. Google's structured-data validator is strict about the shape.
export function breadcrumbJsonLd(crumbs: BreadcrumbCrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: c.url } : {}),
    })),
  };
}
