import type { NextConfig } from 'next';
import { livedocumentsNextConfig } from '@livedocuments/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @livedocuments/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...livedocumentsNextConfig(),
  transpilePackages: ['@livedocuments/ui', '@liveworkspace/comparisons'],
};

export default nextConfig;
