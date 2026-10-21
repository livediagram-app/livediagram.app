import { ImageResponse } from 'next/og';

import { renderCategoryCard } from './opengraph-image';
import { LANDING_SECTION_IDS } from '@/lib/landing-content';

// Twitter card for /features/<id>, mirroring this folder's opengraph-image via
// the shared renderCategoryCard helper. Per-route config (dynamic / size / alt /
// generateStaticParams) is declared inline because Next.js's file-convention
// pipeline can't trace re-exported per-route config through a barrel.

export const dynamic = 'force-static';
export const alt = 'A livediagram feature category';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return LANDING_SECTION_IDS.map((slug) => ({ slug }));
}

export default async function FeatureTwitterImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return new ImageResponse(renderCategoryCard(slug), { ...size });
}
