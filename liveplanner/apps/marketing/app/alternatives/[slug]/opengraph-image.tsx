import { ImageResponse } from 'next/og';

import { comparisonCard, comparisonSlugs, getComparison } from '@liveworkspace/comparisons';
import { cardSubtitle, renderSocialCard } from '@liveplanner/ui';
import { COMPARISONS } from '@/lib/alternatives';

// Each comparison's own social card: the homepage card's branded shell (renderSocialCard) with
// "liveplanner vs <tool>" and the page's h1, so a shared comparison previews as itself. Pre-rendered
// to a static PNG per slug at build time; the page's metadata leaves the brand card off
// (pageMetadata `ownOgImage`) so this is the one Next attaches.

export const dynamic = 'force-static';
export const alt = 'A liveplanner comparison';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return comparisonSlugs(COMPARISONS).map((slug) => ({ slug }));
}

// Shared with the sibling twitter-image route, so the two cards can't drift.
export function renderComparisonCard(slug: string) {
  const card = comparisonCard(COMPARISONS, getComparison(COMPARISONS, slug));
  return renderSocialCard({
    kicker: card.kicker,
    title: card.title,
    subtitle: cardSubtitle(card.subtitle) || undefined,
  });
}

export default async function ComparisonOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return new ImageResponse(renderComparisonCard((await params).slug), { ...size });
}
