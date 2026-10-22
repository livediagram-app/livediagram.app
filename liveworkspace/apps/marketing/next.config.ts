import type { NextConfig } from 'next';
import { livediagramNextConfig } from '@livediagram/next-config';

// Static export, served as Cloudflare static assets at liveworkspace.app (liveworkspace/docs/marketing-site.md).
// The shared settings are livediagram's, whose UI package the site's switcher comes from.
const nextConfig: NextConfig = {
  ...livediagramNextConfig(),
  transpilePackages: ['@livediagram/ui', '@liveworkspace/sites'],
};

export default nextConfig;
