// Renders a schema.org BreadcrumbList <script type="application/ld+json">
// for a subpage. The leading "Home" item is added automatically; callers
// supply the rest of the trail. Most pages are two-level (Home > Page) and
// pass `name`/`path`; deeper pages (e.g. Home > Alternatives > Miro) pass a
// `trail` array. Kept in one place so callers can't drift apart on subtle
// things like trailing slashes or @id formats, which Google's structured-data
// validator is strict about.

const SITE_URL = 'https://livediagram.app';

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
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      // Home uses the slash-less canonical origin to match the homepage's
      // own canonical / og:url (see app/sitemap.ts).
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      ...crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: c.name,
        item: `${SITE_URL}${c.path}`,
      })),
    ],
  };
  return (
    <script
      type="application/ld+json"
      // < escape mirrors layout.tsx + faq/page.tsx: keeps the JSON safe to
      // inline even if a future entry's name accidentally contains a "<".
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, '\\u003c') }}
    />
  );
}
