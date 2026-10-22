import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: resolved at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://liveworkspace.app/', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://liveworkspace.app/telemetry', changeFrequency: 'daily', priority: 0.5 },
  ];
}
