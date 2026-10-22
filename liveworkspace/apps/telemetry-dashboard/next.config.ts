import type { NextConfig } from 'next';
import { livediagramNextConfig } from '@livediagram/next-config';

// Static export, served by the liveworkspace telemetry Worker (../telemetry) under
// liveworkspace.app/telemetry: the Worker strips the prefix to find a file in out/
// (liveworkspace/docs/telemetry.md). The shared settings are livediagram's, which both apps' UI
// packages are built for.
const nextConfig: NextConfig = {
  ...livediagramNextConfig(),
  basePath: '/telemetry',
  transpilePackages: [
    '@livediagram/ui',
    '@livediagram/api-schema',
    '@liveplanner/ui',
    '@liveplanner/api-schema',
    '@liveworkspace/telemetry',
  ],
};

export default nextConfig;
