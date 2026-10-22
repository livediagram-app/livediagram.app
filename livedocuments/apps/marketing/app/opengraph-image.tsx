import { SITE_NAME, SITE_PITCH, renderSocialCard } from '@livedocuments/ui';
import { ImageResponse } from 'next/og';

// Open Graph + Twitter social card (1200x630). Rendered to a static
// PNG at build time by Next.js's `output: 'export'` pipeline so the
// asset ships baked into `out/`; no runtime dependency. Replaces
// the prior empty-preview state where pasting livedocuments.app into
// Slack / Twitter / LinkedIn produced a blank card.
//
// Sibling `twitter-image.tsx` mirrors the same template so the
// Twitter card and OG card stay byte-identical. Both surfaces want
// a 1.91:1 frame at this resolution.
//
// `dynamic = 'force-static'` is required for `output: 'export'`:
// the route handler must be declared fully static so Next resolves
// it at build time, not runtime. The same gate that robots.ts /
// sitemap.ts use.

export const dynamic = 'force-static';
export const alt = `${SITE_NAME}: ${SITE_PITCH}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  return new ImageResponse(renderSocialCard(), { ...size });
}
