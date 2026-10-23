import type { MetadataRoute } from 'next';
import { ALTERNATIVES, ALTERNATIVES_LAST_UPDATED } from '@/lib/alternatives';

// Required for `output: 'export'`: resolved at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://liveworkspace.app/', changeFrequency: 'monthly', priority: 1 },
    // The comparisons (liveworkspace/docs/comparison-pages.md), dated by their last review rather than
    // the build, so a crawler sees only the pages that changed.
    {
      url: 'https://liveworkspace.app/alternatives',
      lastModified: ALTERNATIVES_LAST_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...ALTERNATIVES.map((alt) => ({
      url: `https://liveworkspace.app/alternatives/${alt.slug}`,
      lastModified: alt.updated,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: 'https://liveworkspace.app/telemetry', changeFrequency: 'daily', priority: 0.5 },
    { url: 'https://liveworkspace.app/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://liveworkspace.app/terms', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
