import type { NextConfig } from 'next';
import { liveplannerNextConfig } from '@liveplanner/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @liveplanner/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...liveplannerNextConfig(),
  transpilePackages: [
    '@liveplanner/ui',
    '@liveworkspace/comparisons',
    '@liveworkspace/account-menu',
  ],
};

export default nextConfig;
