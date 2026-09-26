import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: route handlers must declare
// themselves fully static so Next resolves them at build time, same
// rule that applies to robots.ts and sitemap.ts.
export const dynamic = 'force-static';

// Next.js convention: app/manifest.ts → /manifest.webmanifest at build
// time. See docs/specs/019-marketing/marketing-site.md "SEO and metadata".
//
// What this unlocks:
//   - Android Chrome "Add to Home Screen" prompt + a proper standalone
//     launch experience (no URL bar) once installed.
//   - iOS Safari "Add to Home Screen" picks the manifest icon + name
//     for the homescreen tile.
//   - Lighthouse PWA audit gets the basic-installability check.
//
// Icons, in increasing specificity. /icon.svg is the scalable master
// (Next.js also auto-emits a <link> for app/icon.svg). The raster
// PNGs from public/ (livediagram-icon-{256,512}.png) are listed at
// explicit sizes because some Android installers + the Lighthouse PWA
// audit prefer a concrete PNG over an SVG. All are purpose: 'any':
// the mark is a thin stroke whose parentheses reach close to the
// edge, so it has no maskable safe-zone; declaring 'maskable' would
// let an Android circle/squircle mask clip the brackets. An opaque,
// iOS-friendly home-screen tile is handled separately by
// app/apple-icon.tsx (iOS renders transparency as black, so the
// transparent PNGs here would tile badly on iOS).
//
// theme_color matches the viewport export in layout.tsx so the
// installed-app chrome stays brand-blue. background_color paints the
// splash screen behind the icon at launch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'livediagram',
    short_name: 'livediagram',
    description:
      'A real-time multiplayer canvas for diagrams and mindmaps. Built for teams who think visually.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#0EA5E9',
    background_color: '#ffffff',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/livediagram-icon-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/livediagram-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
