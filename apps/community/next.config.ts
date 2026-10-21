import type { NextConfig } from 'next';
import { liveplannerNextConfig } from '@liveplanner/next-config';

// Static export fronted by Cloudflare Static Assets, served under `/community` by the router worker
// (which strips the prefix before forwarding, exactly like `/help` and `/telemetry`). See
// docs/specs/025-community/community.md + docs/specs/016-platform/router-app.md. The shared settings live in
// @liveplanner/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...liveplannerNextConfig(),
  basePath: '/community',
  // Routes export as `<route>/index.html`, so the spec's `/community/post/?id=` resolves cleanly on
  // Cloudflare static assets.
  trailingSlash: true,
  transpilePackages: ['@liveplanner/ui', '@liveplanner/api-schema'],
};

export default nextConfig;
