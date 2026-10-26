import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: resolved at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://liveworkspace.app/', changeFrequency: 'monthly', priority: 1 },
    // Comparison: points at each app's comparisons, which each app's sitemap lists.
    { url: 'https://liveworkspace.app/compare', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://liveworkspace.app/telemetry', changeFrequency: 'daily', priority: 0.5 },
    // Status: every app's services, checked live (liveworkspace/docs/site.md "Status").
    { url: 'https://liveworkspace.app/status', changeFrequency: 'daily', priority: 0.4 },
    // Google Drive sync, the platform's help article (liveworkspace/docs/site.md "Help").
    { url: 'https://liveworkspace.app/help/google-drive', changeFrequency: 'monthly', priority: 0.4 },
    { url: 'https://liveworkspace.app/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://liveworkspace.app/terms', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://liveworkspace.app/licences', changeFrequency: 'monthly', priority: 0.2 },
  ];
}
