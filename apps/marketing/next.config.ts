import type { NextConfig } from 'next';
import { livediagramNextConfig } from '@livediagram/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @livediagram/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...livediagramNextConfig(),
  transpilePackages: ['@livediagram/ui'],
};

export default nextConfig;
