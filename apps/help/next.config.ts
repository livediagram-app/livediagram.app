import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';

// Static export fronted by Cloudflare Static Assets, served under
// `/help` by the router worker (which strips the prefix before
// forwarding, exactly like `/telemetry`). See specs/55 + specs/08.
// MDX powers the article bodies; the article index + navigation pages
// are plain TS/TSX.
// Isolate dev's cache directory from build's. `scripts/next-dev.mjs` sets
// NEXT_DISTDIR=.next-dev before exec'ing `next dev`, so a `next build`
// running anywhere in the same checkout (repo-root `pnpm build`,
// pre-commit suite, turbo task) can't overwrite the dev server's
// `_buildManifest.js.tmp.*` mid-flight — the corruption that left the help
// centre serving 500s and 404ing its `app/layout.css` (unstyled page).
// Build / CI leave the var unset and keep the default `.next/`.
const distDir = process.env.NEXT_DISTDIR ?? '.next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir,
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

// Annotated so the inferred type doesn't reference a non-portable
// node_modules path (TS2742) once dev deps shift the next package's hoist.
const config: NextConfig = withMDX(nextConfig);
export default config;
