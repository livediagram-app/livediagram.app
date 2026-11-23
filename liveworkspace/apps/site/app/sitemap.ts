import type { MetadataRoute } from 'next';
import { proOn } from '@liveworkspace/subscription-ui/flag';

// Required for `output: 'export'`: resolved at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://www.liveworkspace.app/', changeFrequency: 'monthly', priority: 1 },
    // Comparison: points at each app's comparisons, which each app's sitemap lists.
    { url: 'https://www.liveworkspace.app/compare', changeFrequency: 'monthly', priority: 0.5 },
    // The Community, every app's posts together (each app's own gallery and posts are in that app's sitemap).
    { url: 'https://www.liveworkspace.app/community', changeFrequency: 'daily', priority: 0.6 },
    // Pricing, only where Pro is on in the build (liveworkspace/docs/specs/019-subscription/subscription.md).
    ...(proOn()
      ? [
          {
            url: 'https://www.liveworkspace.app/pricing',
            changeFrequency: 'monthly' as const,
            priority: 0.7,
          },
        ]
      : []),
    { url: 'https://www.liveworkspace.app/telemetry', changeFrequency: 'daily', priority: 0.5 },
    // Status: every app's services, checked live (liveworkspace/docs/specs/010-site/site.md "Status").
    { url: 'https://www.liveworkspace.app/status', changeFrequency: 'daily', priority: 0.4 },
    // The help (/help) is the one help centre's (liveworkspace/apps/help), which lists its pages in its own sitemap
    // at /help/sitemap.xml.
    { url: 'https://www.liveworkspace.app/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://www.liveworkspace.app/terms', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://www.liveworkspace.app/licences', changeFrequency: 'monthly', priority: 0.2 },
  ];
}
