import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: route handlers must declare
// themselves fully static so Next resolves them at build time, same
// rule that applies to robots.ts and sitemap.ts.
export const dynamic = 'force-static';

// Next.js convention: app/manifest.ts → /manifest.webmanifest at build
// time. See spec/16-marketing-site.md "SEO and metadata".
//
// What this unlocks:
//   - Android Chrome "Add to Home Screen" prompt + a proper standalone
//     launch experience (no URL bar) once installed.
//   - iOS Safari "Add to Home Screen" picks the manifest icon + name
//     for the homescreen tile.
//   - Lighthouse PWA audit gets the basic-installability check.
//
// The icon points at /icon.svg (Next.js convention emits a <link>
// tag for app/icon.svg automatically; referencing the same path here
// reuses one asset). purpose: 'any' covers both decorated and
// monochrome contexts because the icon is a single brand stroke on
// transparent.
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
    ],
  };
}
