import { installIconResponse } from '@/lib/install-icon';

// iOS's home-screen tile (site.md "Installing"). Next.js convention: app/apple-icon.tsx → /apple-icon.png and its
// <link rel="apple-touch-icon">. Painted on white, since iOS shows a transparent tile's empty pixels as black.
export const dynamic = 'force-static';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return installIconResponse(180, { tile: true });
}
