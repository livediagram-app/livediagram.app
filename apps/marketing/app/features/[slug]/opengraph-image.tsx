import { ImageResponse } from 'next/og';

import { renderSocialCard } from '@/app/opengraph-image';
import { getLandingSection, LANDING_SECTION_IDS } from '@/lib/landing-content';

// Per-category social card for /features/<id>: the same branded shell as the
// homepage OG card (renderSocialCard), but with the category's own headline so
// a shared category link shows a distinctive preview rather than the generic
// brand card. Pre-rendered to a static PNG per slug at build time (the same
// force-static gate the other image routes use). The page's metadata omits an
// explicit openGraph image (pageMetadata `ownOgImage: true`) so this
// file-convention image is the one Next attaches.

export const dynamic = 'force-static';
export const alt = 'A livediagram feature category';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return LANDING_SECTION_IDS.map((slug) => ({ slug }));
}

// Shared by this route and the sibling twitter-image route so the two cards
// can't drift. (Per-route config like `size`/`alt` can't be re-exported
// through a barrel, but a plain helper import is fine.)
export function renderCategoryCard(slug: string) {
  const section = getLandingSection(slug);
  const description = section?.description ?? '';
  const subtitle =
    description.length > 120 ? `${description.slice(0, 117).trimEnd()}…` : description;
  return renderSocialCard({
    kicker: 'livediagram feature',
    title: section?.title ?? 'Features',
    subtitle: subtitle || undefined,
  });
}

export default async function FeatureOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return new ImageResponse(renderCategoryCard(slug), { ...size });
}
