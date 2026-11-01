import type { NextConfig } from 'next';
import { liveworkspaceNextConfig } from '@liveworkspace/next-config';

// Static export fronted by Cloudflare Static Assets, served under `/community` by the router worker
// (which strips the prefix before forwarding, exactly like `/help` and `/telemetry`). See
// docs/specs/025-community/community.md + docs/specs/016-platform/router-app.md. The shared settings live in
// @liveworkspace/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...liveworkspaceNextConfig(),
  basePath: '/community',
  // Routes export as `<route>/index.html`, so the spec's `/community/post/?id=` resolves cleanly on
  // Cloudflare static assets.
  trailingSlash: true,
  transpilePackages: ['@livehuddle/ui', '@liveworkspace/ui', '@livehuddle/api-schema'],
};

export default nextConfig;
