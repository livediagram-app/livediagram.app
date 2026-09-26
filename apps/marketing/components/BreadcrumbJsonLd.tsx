// Renders a schema.org BreadcrumbList <script type="application/ld+json">
// for a subpage. The leading "Home" item is added automatically; callers
// supply the rest of the trail. Most pages are two-level (Home > Page) and
// pass `name`/`path`; deeper pages (e.g. Home > Alternatives > Miro) pass a
// `trail` array. Kept in one place so callers can't drift apart on subtle
// things like trailing slashes or @id formats, which Google's structured-data
// validator is strict about. The BreadcrumbList shape itself comes from the
// shared breadcrumbJsonLd builder, which the help centre uses too.

import { breadcrumbJsonLd, JsonLd, SITE_URL } from '@livediagram/ui';

type Crumb = { name: string; path: string };

type BreadcrumbJsonLdProps = {
  // Two-level shorthand: a single crumb after Home. `path` is the canonical
  // path with a leading slash and no trailing slash, matching the per-page
  // alternates.canonical declarations.
  name?: string;
  path?: string;
  // Deeper trail (each crumb after Home), used instead of name/path when a
  // page sits more than one level down.
  trail?: Crumb[];
};

export function BreadcrumbJsonLd({ name, path, trail }: BreadcrumbJsonLdProps) {
  const crumbs: Crumb[] = trail ?? (name && path ? [{ name, path }] : []);
  const json = breadcrumbJsonLd([
    // Home uses the slash-less canonical origin to match the homepage's own
    // canonical / og:url (see app/sitemap.ts).
    { name: 'Home', url: SITE_URL },
    ...crumbs.map((c) => ({ name: c.name, url: `${SITE_URL}${c.path}` })),
  ]);
  return <JsonLd data={json} />;
}
