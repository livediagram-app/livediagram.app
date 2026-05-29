import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/live',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui', '@livediagram/diagram'],
};

export default nextConfig;
