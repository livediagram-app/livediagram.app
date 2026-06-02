import type { MetadataRoute } from 'next';

import { ALTERNATIVE_SLUGS, ALTERNATIVES_LAST_UPDATED } from '@/lib/alternatives';
import { LEGAL_LAST_UPDATED } from '@/lib/legal-revisions';

// Required for `output: 'export'` (same reason as robots.ts):
// route handlers must declare themselves fully static so Next
// resolves them at build time, not runtime.
export const dynamic = 'force-static';

// Next.js convention: app/sitemap.ts → /sitemap.xml at build time.
// See spec/16-marketing-site.md "SEO and metadata".
//
// Lists the indexable pages on the marketing origin. The editor
// (/live/*) and API (/api/*) live on the same domain but aren't
// public-content surfaces, so they don't belong in the sitemap.
//
// When a new public page lands, add it here AND wire up its
// per-page alternates.canonical block. Updating one without the
// other is a regression.
//
// `lastModified` per page reflects the truth of when that page's
// content last changed. The landing + FAQ pages update with most
// product releases, so they use the build-time `now`. Terms +
// Privacy share their revision date with the visible "Last
// updated" line on each page via lib/legal-revisions.ts, so
// bumping the legal copy is a one-line ISO change.
//
// ALTERNATIVES_LAST_UPDATED lives alongside the ALTERNATIVES array
// in lib/alternatives.ts so the sitemap, the per-competitor pages'
// article:modified_time OG meta, and the data revision all share
// one constant. See spec/21 "Metadata".

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = 'https://livediagram.app';
  return [
    {
      // No trailing slash, to match the homepage canonical / og:url /
      // JSON-LD (Next emits the root URL slash-less under trailingSlash:
      // false) and the slash-less subpage convention below.
      url: base,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${base}/terms`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Comparison / "alternative" pages (spec/21). Derived from the same
    // ALTERNATIVES list the route + metadata use, so adding a competitor
    // updates the sitemap automatically.
    {
      url: `${base}/alternatives`,
      lastModified: ALTERNATIVES_LAST_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...ALTERNATIVE_SLUGS.map((slug) => ({
      url: `${base}/alternatives/${slug}`,
      lastModified: ALTERNATIVES_LAST_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
