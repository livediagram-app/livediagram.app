import type { NextConfig } from 'next';
import { typescriptConfig } from '@livediagram/next-config';

// Static export fronted by Cloudflare Static Assets, served under `/community` by the router worker
// (which strips the prefix before forwarding, exactly like `/help` and `/telemetry`). See
// docs/specs/025-community/community.md + docs/specs/016-platform/router-app.md.
// `scripts/next-dev.mjs` sets NEXT_DISTDIR=.next-dev before exec'ing `next dev`, so a `next build` in
// the same checkout can't corrupt the dev server's cache. Build / CI leave it unset and keep `.next`.
const distDir = process.env.NEXT_DISTDIR ?? '.next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir,
  // Type-checked by CI's Checks; only E2E builds skip it here (@livediagram/next-config).
  typescript: typescriptConfig(),
  basePath: '/community',
  // Routes export as `<route>/index.html`, so the spec's `/community/post/?id=` resolves cleanly on
  // Cloudflare static assets.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui', '@livediagram/api-schema'],
};

export default nextConfig;
