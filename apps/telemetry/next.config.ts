import type { NextConfig } from 'next';
import { liveplannerNextConfig } from '@liveplanner/next-config';

// Static export fronted by Cloudflare Static Assets, served under `/telemetry` by the router worker (which strips
// the prefix before forwarding, exactly like `/live`). See docs/specs/017-telemetry/telemetry.md +
// docs/specs/016-platform/router-app.md. The shared settings live in @liveplanner/next-config
// (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...liveplannerNextConfig(),
  basePath: '/telemetry',
  transpilePackages: ['@liveplanner/ui', '@liveplanner/api-schema'],
};

export default nextConfig;
