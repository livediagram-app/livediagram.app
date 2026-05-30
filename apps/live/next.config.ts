import type { NextConfig } from 'next';

// `output: 'export'` is required for the production build (Cloudflare
// Static Assets fronts a fully static export — no Node runtime). In
// dev we omit it so the dynamic-segment route at `/diagram/[id]` can
// resolve arbitrary user-minted ids without needing them enumerated
// in `generateStaticParams`. The production build still ships a
// single placeholder file backed by the live worker's path rewrite
// (spec/14).
const isProdBuild = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProdBuild ? { output: 'export' } : {}),
  basePath: '/live',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui', '@livediagram/diagram'],
};

export default nextConfig;
