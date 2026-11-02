import { SITE_DESCRIPTION } from '@livehuddle/ui';
import { appIcons, installManifest } from '@liveworkspace/marketing-site/lib/install';
import type { MetadataRoute } from 'next';

// Required for `output: 'export'`: route handlers must declare themselves fully static so Next resolves them at build
// time, the same rule robots.ts and sitemap.ts follow.
export const dynamic = 'force-static';

// Next.js convention: app/manifest.ts → /manifest.webmanifest, linked by every page on the address (the editor's
// layout too). What makes livehuddle installable to a home screen (docs/specs/016-platform/installable-app.md): standalone,
// opening at the Explorer rather than this marketing page, and the icons. Built once for every app
// (@liveworkspace/marketing-site/lib/install). The PNGs are purpose `any`: the Living Prism's corners reach outside
// the maskable safe zone. iOS's opaque home-screen tile is app/apple-icon.tsx. theme_color matches layout.tsx's
// viewport, so the installed app's chrome stays brand-blue.
export default function manifest(): MetadataRoute.Manifest {
  return installManifest({
    name: 'livehuddle',
    description: SITE_DESCRIPTION,
    themeColor: '#0EA5E9',
    icons: appIcons('livehuddle'),
  });
}
