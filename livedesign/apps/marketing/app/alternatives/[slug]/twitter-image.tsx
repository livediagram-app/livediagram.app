import { ImageResponse } from 'next/og';

import { comparisonSlugs } from '@liveworkspace/comparisons';
import { renderComparisonCard } from './opengraph-image';
import { COMPARISONS } from '@/lib/alternatives';

// Twitter card for /alternatives/<slug>, mirroring this folder's opengraph-image. Per-route config
// is declared inline because Next's file-convention pipeline can't trace it through a re-export.

export const dynamic = 'force-static';
export const alt = 'A livedesign comparison';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return comparisonSlugs(COMPARISONS).map((slug) => ({ slug }));
}

export default async function ComparisonTwitterImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return new ImageResponse(renderComparisonCard((await params).slug), { ...size });
}
