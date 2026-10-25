import type { MetadataRoute } from 'next';

import { comparisonSitemap } from '@liveworkspace/comparisons';

import { COMPARISONS } from '@/lib/alternatives';
import { LANDING_SECTION_IDS } from '@/lib/landing-content';
import { SITE_URL } from '@livedocuments/ui';

// Required for `output: 'export'` (same reason as robots.ts):
// route handlers must declare themselves fully static so Next
// resolves them at build time, not runtime.
export const dynamic = 'force-static';

// Next.js convention: app/sitemap.ts → /sitemap.xml at build time.
// See docs/specs/019-marketing/marketing-site.md "SEO and metadata".
//
// Lists the indexable pages on the marketing origin. /status and /telemetry
// redirect to liveworkspace.app's pages, one for every app (liveworkspace/docs/site.md),
// so neither is listed. The editor (/live/*) and API (/api/*) live on the same
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
    // Build with AI (docs/specs/019-marketing/build-with-ai.md): the MCP setup page, a header link on every page.
    {
      url: `${base}/ai`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // One page per feature category (docs/specs/019-marketing/marketing-site.md "Feature category pages").
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
    // /terms and /privacy are intentionally omitted: the terms and privacy policy
    // are liveworkspace's, on liveworkspace.app (its sitemap lists them), and
    // each marketing route is now a noindex redirect there.
    // Third-party licences (docs/specs/002-project-scope/third-party-licences.md):
    // a transparency page, regenerated every build (blueprint D13).
    {
      url: `${base}/licences`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    }, // The comparisons (packages/comparisons/README.md "Metadata"): the hub and one page per
    // competitor, from the same list as the routes, dated by their last review rather than the build.
    ...comparisonSitemap(COMPARISONS),
  ];
}
