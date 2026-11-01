import { installManifest } from '@liveworkspace/marketing-site/lib/install';
import type { MetadataRoute } from 'next';

// Required for `output: 'export'`.
export const dynamic = 'force-static';

// liveworkspace.app's web app manifest (site.md "Installing"): installable to a home screen, opening at the Explorer,
// built the same way as every app's. On an app's address the Explorer's pages link that app's own manifest instead,
// since /manifest.webmanifest there is the app's.
export default function manifest(): MetadataRoute.Manifest {
  return installManifest({
    name: 'liveworkspace',
    description:
      'One account and one Explorer across livediagram, liveplanner, livedocuments and livedesign.',
    themeColor: '#64748b',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/liveworkspace-icon-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/liveworkspace-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}
