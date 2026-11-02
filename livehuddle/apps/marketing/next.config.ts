import type { NextConfig } from 'next';
import { liveworkspaceNextConfig } from '@liveworkspace/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @liveworkspace/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...liveworkspaceNextConfig(),
  transpilePackages: [
    '@livehuddle/ui',
    '@liveworkspace/ui',
    '@liveworkspace/comparisons',
    '@liveworkspace/marketing-site',
    '@liveworkspace/account-menu',
  ],
};

export default nextConfig;
