import createMDX from '@next/mdx';

// A help app's Next settings on top of the shared ones (README.md "Next config"). The app spreads
// liveworkspaceNextConfig() and names its own ui package, then hands that here:
//
//   export default withHelpSite({ ...liveworkspaceNextConfig(), transpilePackages: ['@livediagram/ui', …] });
//
// Static export fronted by Cloudflare Static Assets, served under `/help` by the router worker (which strips the
// prefix before forwarding, exactly like `/telemetry`). See docs/specs/018-help/help-app.md and
// docs/specs/016-platform/router-app.md in each product. MDX powers the article bodies; the index and
// navigation pages are plain TS/TSX.

// remark-gfm enables GitHub-flavoured markdown in MDX bodies, most importantly pipe tables, which plain MDX
// renders as literal text. Also covers strikethrough, autolinks, and task lists. Named as a string, not
// imported: Turbopack (the default builder since Next 16) serialises loader options to pass them to its Rust
// side, so an imported plugin function fails the build with "does not have serializable options". It resolves
// the package itself, from the app. The cast-free form is fine in JS; unified's `PluggableList` type only
// admits functions.
const withMDX = createMDX({ options: { remarkPlugins: [['remark-gfm', {}]] } });

/** @param {import('next').NextConfig} config */
export function withHelpSite(config) {
  return withMDX({
    ...config,
    basePath: '/help',
    // Every route exports as `<route>/index.html` so trailing-slash links (used across the help centre) resolve
    // cleanly on Cloudflare static assets, and feature landing pages don't collide with their sub-article
    // directories.
    trailingSlash: true,
    pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
    // The shared components ship as TypeScript source, like every workspace package.
    transpilePackages: [...(config.transpilePackages ?? []), '@liveworkspace/help-site'],
  });
}
