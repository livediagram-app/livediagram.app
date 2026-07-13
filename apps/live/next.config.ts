import type { NextConfig } from 'next';

// `output: 'export'` is required for the production build (Cloudflare
// Static Assets fronts a fully static export — no Node runtime). In
// dev we omit it so the dynamic-segment route at `/diagram/[id]` can
// resolve arbitrary user-minted ids without needing them enumerated
// in `generateStaticParams`. The production build still ships a
// single placeholder file backed by the live worker's path rewrite
// (spec/14).
const isProdBuild = process.env.NODE_ENV === 'production';

// distDir split keeps `next dev` from racing `next build` on
// `apps/live/.next/`. Without this, a build kicked off in the same
// checkout (e.g. from a pre-commit suite) overwrites the dev
// server's `_buildManifest.js.tmp.*` files mid-flight, and dev
// then 500s with `ENOENT: ... _buildManifest.js.tmp.*` until the
// cache is wiped by hand. We move DEV (not build) to its own
// directory because the build's `.next/` layout is what CI + the
// deploy workflow expect, and a build invoked without env vars
// (e.g. ad-hoc `next build`) should still work. `scripts/dev.mjs`
// sets `NEXT_DISTDIR=.next-dev` before exec'ing `next dev` so dev
// always lands in `.next-dev/`; everything else defaults to `.next/`.
const distDir = process.env.NEXT_DISTDIR ?? '.next';

const nextConfig: NextConfig = {
  ...(isProdBuild ? { output: 'export' } : {}),
  distDir,
  // Pages serve at clean root paths (/diagram, /explorer, /new, ...);
  // the router selects the live app by route (spec/08), so there's no
  // `/live` basePath in the URL any more. Only the bundled `_next`
  // assets keep a `/live` prefix so they don't collide with marketing's
  // `/_next` — the router strips `/live` before forwarding, so the prod
  // worker serves them from `out/_next`. The prefix applies in dev too
  // (Next's dev server serves the prefixed asset paths itself) so the
  // local router (spec/08) can disambiguate `/_next` the same way prod
  // does; standalone `localhost:3002` keeps working either way.
  assetPrefix: '/live',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@livediagram/ui', '@livediagram/diagram', '@livediagram/api-schema'],
};

export default nextConfig;
