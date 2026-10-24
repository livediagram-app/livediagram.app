import type { Alternative, Comparisons } from './types';

// Everything an app's routes, metadata and sitemap read from its list, so adding a competitor is a
// one-place change (README.md "Routes").

export const HUB_PATH = '/alternatives';

export function comparisonPath(slug: string): `/${string}` {
  return `${HUB_PATH}/${slug}`;
}

export function comparisonSlugs(c: Comparisons): string[] {
  return c.alternatives.map((alt) => alt.slug);
}

// Exactly as written: a case-insensitive lookup would render a non-canonical address.
export function getComparison(c: Comparisons, slug: string): Alternative | undefined {
  return c.alternatives.find((alt) => alt.slug === slug);
}

// Up to `count` other comparisons for the foot of a page, starting after this one so each page
// links on to different neighbours and every page is linked from another.
export function otherComparisons(c: Comparisons, slug: string, count = 3): Alternative[] {
  const at = c.alternatives.findIndex((alt) => alt.slug === slug);
  const rest = [...c.alternatives.slice(at + 1), ...c.alternatives.slice(0, Math.max(at, 0))];
  return rest.slice(0, count);
}

// schema.org ItemList for the hub: the shape for a curated index of related pages, built from the
// same list as the visible grid and the sitemap. Its description names every competitor; the meta
// description is a fixed sentence, since every name would outgrow a search result.
export function hubItemListJsonLd(c: Comparisons) {
  const names = new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(
    c.alternatives.map((alt) => alt.name),
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: c.hub.heading,
    description: `Side-by-side comparisons of ${c.app} against ${names}.`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: c.alternatives.length,
    itemListElement: c.alternatives.map((alt, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${c.siteUrl}${comparisonPath(alt.slug)}`,
      name: `${c.app} vs ${alt.name}`,
    })),
  };
}

// schema.org FAQPage for one comparison: its questions target the long-tail queries around
// "<tool> alternative" searches, and the answers match the page's word for word.
export function faqJsonLd(alt: Alternative) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: alt.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

// The hub and every comparison for the app's sitemap, dated by the last review rather than the
// build, so a crawler sees only pages that changed.
export function comparisonSitemap(c: Comparisons) {
  return [
    {
      url: `${c.siteUrl}${HUB_PATH}`,
      lastModified: c.updated,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    ...c.alternatives.map((alt) => ({
      url: `${c.siteUrl}${comparisonPath(alt.slug)}`,
      lastModified: c.updated,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}

// The words on a comparison's social card: who against whom, the page's h1, and the start of its
// description (the app's renderSocialCard draws them in its own brand).
export function comparisonCard(c: Comparisons, alt: Alternative | undefined) {
  return {
    kicker: alt ? `${c.app} vs ${alt.name}` : 'Comparison',
    title: alt?.h1 ?? c.hub.heading,
    subtitle: alt?.description ?? c.hub.description,
  };
}

// The date as the pages print it: "23 October 2026", in UTC so the build's time zone can't move it.
export function reviewedOn(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
