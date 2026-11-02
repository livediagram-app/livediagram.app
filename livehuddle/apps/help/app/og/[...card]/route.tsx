import { ImageResponse } from 'next/og';
import { renderSocialCard } from '@livehuddle/ui';
import { site } from '@/lib/help-site';

// One PNG per help article and category landing, at /help/og/<route>.png (docs/specs/018-help/help-app.md "SEO"),
// on the product's branded card. Pre-rendered at build time for the static export, like marketing's
// opengraph-image routes; nothing renders at request time.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return site.cardParams();
}

export async function GET(_request: Request, { params }: { params: Promise<{ card: string[] }> }) {
  const card = site.cardFor((await params).card);
  if (!card) return new Response('Not found', { status: 404 });
  return new ImageResponse(renderSocialCard(card), { width: 1200, height: 630 });
}
