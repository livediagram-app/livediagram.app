import type { MetadataRoute } from 'next';

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
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = 'https://livediagram.app';
  return [
    {
      url: `${base}/`,
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
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
