import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: resolved at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/', changeFrequency: 'monthly', priority: 1 },
    // Comparison: points at each app's comparisons, which each app's sitemap lists.
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/compare', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/telemetry', changeFrequency: 'daily', priority: 0.5 },
    // Status: every app's services, checked live (liveworkspace/docs/site.md "Status").
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/status', changeFrequency: 'daily', priority: 0.4 },
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/terms', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/licences', changeFrequency: 'monthly', priority: 0.2 },
  ];
}
