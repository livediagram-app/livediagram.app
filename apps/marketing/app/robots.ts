import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: route handlers must declare
// themselves fully static so Next can resolve them at build time
// rather than expecting a runtime. Without this the marketing
// build fails with "export const dynamic = 'force-static' not
// configured" during page-data collection.
export const dynamic = 'force-static';

// Next.js convention: app/robots.ts → /robots.txt at build time.
// See spec/16-marketing-site.md "SEO and metadata".
//
// /live/* and /api/* live on the SAME origin as marketing (the
// router worker stitches all three under one hostname), so a
// blanket "allow: /" lets crawlers waste budget probing the
// editor's auth-walled HTML and the API's JSON. Both surfaces
// also carry their own deterrents (the live app declares
// noindex/nofollow at the root layout, per spec/07; the API
// returns JSON crawlers can't index meaningfully), but a
// belt-and-braces Disallow stops well-behaved crawlers from
// even fetching them.
//
// allow: ['/'] keeps the marketing surface (/, /faq, /terms,
// /privacy, /sitemap.xml, /robots.txt) discoverable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/', '/api/'],
    },
    sitemap: 'https://livediagram.app/sitemap.xml',
  };
}
