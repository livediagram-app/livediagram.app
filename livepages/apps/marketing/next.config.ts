import type { NextConfig } from 'next';
import { livepagesNextConfig } from '@livepages/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @livepages/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...livepagesNextConfig(),
  transpilePackages: ['@livepages/ui'],
};

export default nextConfig;
