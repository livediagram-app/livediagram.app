import type { MetadataRoute } from 'next';

// Next.js convention: app/robots.ts → /robots.txt at build time.
// See spec/16-marketing-site.md "SEO and metadata".
//
// Allow all crawlers everything. The editor and API don't sit
// behind robots policy (they're on the same origin but aren't
// content surfaces, and crawlers can't usefully index them
// anyway). When a private path lands (e.g. an admin route) add
// it to `disallow`.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://livediagram.app/sitemap.xml',
  };
}
