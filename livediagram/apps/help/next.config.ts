import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import { livediagramNextConfig } from '@livediagram/next-config';

// Static export fronted by Cloudflare Static Assets, served under `/help` by the router worker (which strips the
// prefix before forwarding, exactly like `/telemetry`). See docs/specs/018-help/help-app.md +
// docs/specs/016-platform/router-app.md. MDX powers the article bodies; the article index + navigation pages are
// plain TS/TSX. The shared settings live in @livediagram/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...livediagramNextConfig(),
  basePath: '/help',
  // Every route exports as `<route>/index.html` so trailing-slash links
  // (used across the help centre) resolve cleanly on Cloudflare static
  // assets, and feature landing pages don't collide with their
  // sub-article directories. Mirrors the Manager Toolkit help app.
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  transpilePackages: ['@livediagram/ui'],
};

// remark-gfm enables GitHub-flavoured markdown in MDX bodies — most importantly
// pipe tables (e.g. the link-expiry table), which plain MDX renders as literal
// text. Also covers strikethrough, autolinks, and task lists.
// Named as a string, not imported: Turbopack (the default builder since Next
// 16) serialises loader options to pass them to its Rust side, so an imported
// plugin function fails the build with "does not have serializable options".
// It resolves the package itself. The cast is needed because unified's
// `PluggableList` only admits functions, never the string form Turbopack wants.
const withMDX = createMDX({
  options: { remarkPlugins: [['remark-gfm', {}]] as never },
});

// Annotated so the inferred type doesn't reference a non-portable
// node_modules path (TS2742) once dev deps shift the next package's hoist.
const config: NextConfig = withMDX(nextConfig);

export default config;
