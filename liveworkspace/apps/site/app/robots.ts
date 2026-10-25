import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: resolved at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/sitemap.xml',
  };
}
