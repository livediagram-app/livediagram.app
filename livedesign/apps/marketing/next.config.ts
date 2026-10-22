import type { NextConfig } from 'next';
import { livedesignNextConfig } from '@livedesign/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @livedesign/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...livedesignNextConfig(),
  transpilePackages: ['@livedesign/ui'],
};

export default nextConfig;
