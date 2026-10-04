import type { NextConfig } from 'next';
import { typescriptConfig } from '@livediagram/next-config';

// `scripts/next-dev.mjs` sets NEXT_DISTDIR=.next-dev before exec'ing
// `next dev`, so a `next build` in the same checkout can't corrupt the
// dev server's cache (the `_buildManifest.js.tmp.*` ENOENT 500s).
// Build / CI leave it unset and keep the default `.next`.
const distDir = process.env.NEXT_DISTDIR ?? '.next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir,
  // Type-checked by CI's Checks; only E2E builds skip it here (@livediagram/next-config).
  typescript: typescriptConfig(),
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui'],
};

export default nextConfig;
