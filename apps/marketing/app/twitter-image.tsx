import { ImageResponse } from 'next/og';
import { renderSocialCard } from './opengraph-image';

// Twitter Card image. Mirrors opengraph-image.tsx; the shared
// `renderSocialCard()` template keeps the two byte-identical so a
// future copy or design change updates both surfaces in lockstep.
// We declare the static-export gate + size + alt inline (rather
// than re-exporting) because Next.js's file-convention pipeline
// can't trace re-exported per-route config through a barrel.

export const dynamic = 'force-static';
export const alt = 'livediagram: a real-time multiplayer canvas for diagrams and mindmaps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function TwitterImage() {
  return new ImageResponse(renderSocialCard(), { ...size });
}
