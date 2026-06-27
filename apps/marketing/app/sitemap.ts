import type { MetadataRoute } from 'next';

import { ALTERNATIVE_SLUGS, ALTERNATIVES_LAST_UPDATED } from '@/lib/alternatives';
import { LANDING_SECTION_IDS } from '@/lib/landing-content';
import { SITE_URL } from '@/lib/site';

// Required for `output: 'export'` (same reason as robots.ts):
// route handlers must declare themselves fully static so Next
// resolves them at build time, not runtime.
export const dynamic = 'force-static';

// Next.js convention: app/sitemap.ts → /sitemap.xml at build time.
// See spec/16-marketing-site.md "SEO and metadata".
//
// Lists the indexable pages on the marketing origin, plus the two
// public operational surfaces (/telemetry, /status) that hang off the
// footer. The editor (/live/*) and API (/api/*) live on the same
// domain but aren't public-content surfaces, so they don't belong in
// the sitemap (robots.ts Disallows them too).
//
// When a new public page lands, add it here AND wire up its
// per-page alternates.canonical block. Updating one without the
// other is a regression.
//
// `lastModified` per page reflects the truth of when that page's
// content last changed. The landing + FAQ pages update with most
// product releases, so they use the build-time `now`. The Terms and
// Privacy Policy moved into the help centre (its own sitemap lists the
// canonical articles), so they are not listed here.
//
// ALTERNATIVES_LAST_UPDATED lives alongside the ALTERNATIVES array
// in lib/alternatives.ts so the sitemap, the per-competitor pages'
// article:modified_time OG meta, and the data revision all share
// one constant. See spec/21 "Metadata".

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = SITE_URL;
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
    // One page per feature category (spec/16 "Feature category pages").
    // Derived from LANDING_SECTION_IDS so adding a section to LANDING_SECTIONS
    // sitemaps its page automatically. Build-time `now`: the feature copy
    // moves with product releases, like the landing page. (There is no
    // /features hub index page; the landing page is the feature overview.)
    ...LANDING_SECTION_IDS.map((id) => ({
      url: `${base}/features/${id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // /terms and /privacy are intentionally omitted: both legal pages moved
    // into the help centre (its own sitemap lists the canonical articles), and
    // each marketing route is now a noindex redirect there.
    // Operational surfaces reachable from the footer (spec/16). Lower
    // priority than the marketing content above: they're transparency
    // pages, not landing destinations, but they're public + indexable
    // (each sets robots index:true and a self-canonical), so listing
    // them lets crawlers find them without relying on footer links
    // alone. Build-time `now`: /telemetry reflects live event data and
    // /status reflects the latest deployed state, so both are "fresh as
    // of this build" rather than carrying a tracked revision constant.
    {
      url: `${base}/telemetry`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.4,
    },
    {
      url: `${base}/status`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.4,
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
