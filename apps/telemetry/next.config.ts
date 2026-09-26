import type { NextConfig } from 'next';

// Static export fronted by Cloudflare Static Assets, served under
// `/telemetry` by the router worker (which strips the prefix before
// forwarding, exactly like `/live`). See docs/specs/017-telemetry/telemetry.md + docs/specs/016-platform/router-app.md.
// `scripts/next-dev.mjs` sets NEXT_DISTDIR=.next-dev before exec'ing
// `next dev`, so a `next build` in the same checkout can't corrupt the
// dev server's cache (the `_buildManifest.js.tmp.*` ENOENT 500s).
// Build / CI leave it unset and keep the default `.next`.
const distDir = process.env.NEXT_DISTDIR ?? '.next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir,
  basePath: '/telemetry',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui', '@livediagram/api-schema'],
};

export default nextConfig;
