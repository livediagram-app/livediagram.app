import type { NextConfig } from 'next';
import { livediagramNextConfig } from '@livediagram/next-config';

// liveworkspace.app: one static export, served as Cloudflare static assets (liveworkspace/docs/site.md).
// Every page is here: the home page, the telemetry dashboard, the sign-in pages and the account
// pages, and the Explorer. The APIs are Workers on more specific routes of the same origin: accounts on
// /api/auth/* and /api/account/* (and the two .well-known documents), the index on /api/index/* (the
// Explorer's lists), telemetry on /api/telemetry/*, the
// Community on /api/community/* (whose pages each app hosts itself; liveworkspace.app has none).
// The shared settings are livediagram's,
// whose UI package the site's switcher and the dashboard come from.

// In development the dev server stands in for those routes, so the whole site works from one
// origin, http://localhost:3000, as it does in production. Not exported in dev, since a static
// export can't proxy.
const ACCOUNTS_DEV = process.env.ACCOUNTS_DEV_ORIGIN ?? 'http://localhost:8787';
const TELEMETRY_DEV = process.env.TELEMETRY_DEV_ORIGIN ?? 'http://localhost:8790';
const COMMUNITY_DEV = process.env.COMMUNITY_DEV_ORIGIN ?? 'http://localhost:8791';
const INDEX_DEV = process.env.INDEX_DEV_ORIGIN ?? 'http://localhost:8793';

// The build's assets under a path of their own (@liveworkspace/sites/workspace-proxy SITE_ASSET_PREFIX), because the
// sign-in pages and the Explorer are also served under each app's own address, whose `/_next` is the app's. The
// export still writes them to out/_next; `build` moves them under the prefix (scripts/asset-prefix.mjs), so
// liveworkspace.app serves them at the same path. Locally the dev server serves the prefix itself.
const ASSET_PREFIX = '/_liveworkspace';

const nextConfig: NextConfig = {
  ...livediagramNextConfig({ exportInDev: false }),
  assetPrefix: ASSET_PREFIX,
  transpilePackages: [
    '@livediagram/ui',
    '@livediagram/api-schema',
    '@liveplanner/ui',
    '@liveplanner/api-schema',
    '@liveplanner/items',
    '@livedocuments/ui',
    '@livedocuments/api-schema',
    '@livedesign/ui',
    '@livedesign/api-schema',
    '@liveworkspace/auth-client',
    '@liveworkspace/explorer',
    '@liveworkspace/index-client',
    '@liveworkspace/sites',
    '@liveworkspace/telemetry',
    '@liveworkspace/trusted-types',
  ],
  ...(process.env.NODE_ENV === 'production'
    ? {}
    : {
        async rewrites() {
          return [
            { source: '/api/auth/:path*', destination: `${ACCOUNTS_DEV}/api/auth/:path*` },
            { source: '/api/account/:path*', destination: `${ACCOUNTS_DEV}/api/account/:path*` },
            { source: '/.well-known/:path*', destination: `${ACCOUNTS_DEV}/.well-known/:path*` },
            {
              source: '/api/telemetry/:path*',
              destination: `${TELEMETRY_DEV}/api/telemetry/:path*`,
            },
            { source: '/api/index/:path*', destination: `${INDEX_DEV}/api/index/:path*` },
            {
              source: '/api/community/:path*',
              destination: `${COMMUNITY_DEV}/api/community/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
