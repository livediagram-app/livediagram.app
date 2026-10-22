import { ImageResponse } from 'next/og';
import { renderSocialCard } from '@livedocuments/ui';
import { HELP_CARDS, helpCardParams, routeFromParams } from '@/lib/help-cards';

// One PNG per help article and category landing, at /help/og/<route>.png (lib/help-cards.ts,
// docs/specs/018-help/help-app.md "SEO"). Pre-rendered at build time for the static export, like
// marketing's opengraph-image routes; nothing renders at request time.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return helpCardParams();
}

export async function GET(_request: Request, { params }: { params: Promise<{ card: string[] }> }) {
  const route = routeFromParams((await params).card);
  const card = route === null ? undefined : HELP_CARDS.get(route);
  if (!card) return new Response('Not found', { status: 404 });
  return new ImageResponse(renderSocialCard(card), { width: 1200, height: 630 });
}
