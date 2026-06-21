import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';

// Static export fronted by Cloudflare Static Assets, served under
// `/help` by the router worker (which strips the prefix before
// forwarding, exactly like `/telemetry`). See specs/55 + specs/08.
// MDX powers the article bodies; the article index + navigation pages
// are plain TS/TSX.
const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/help',
  // Every route exports as `<route>/index.html` so trailing-slash links
  // (used across the help centre) resolve cleanly on Cloudflare static
  // assets, and feature landing pages don't collide with their
  // sub-article directories. Mirrors the Manager Toolkit help app.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui'],
};

// remark-gfm enables GitHub-flavoured markdown in MDX bodies — most importantly
// pipe tables (e.g. the link-expiry table), which plain MDX renders as literal
// text. Also covers strikethrough, autolinks, and task lists.
const withMDX = createMDX({ options: { remarkPlugins: [remarkGfm] } });

export default withMDX(nextConfig);
