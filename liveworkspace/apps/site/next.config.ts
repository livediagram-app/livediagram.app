import type { NextConfig } from 'next';
import { livediagramNextConfig } from '@livediagram/next-config';

// liveworkspace.app: one static export, served as Cloudflare static assets (liveworkspace/docs/site.md).
// Every page is here: the home page, the telemetry dashboard and the sign-in pages. The APIs are two
// Workers on more specific routes of the same origin: accounts on /api/auth/* (and the two
// .well-known documents), telemetry on /api/telemetry/*. The shared settings are livediagram's,
// whose UI package the site's switcher and the dashboard come from.

// In development the dev server stands in for those routes, so the whole site works from one
// origin, http://localhost:3300, as it does in production. Not exported in dev, since a static
// export can't proxy.
const ACCOUNTS_DEV = process.env.ACCOUNTS_DEV_ORIGIN ?? 'http://localhost:8787';
const TELEMETRY_DEV = process.env.TELEMETRY_DEV_ORIGIN ?? 'http://localhost:8790';

const nextConfig: NextConfig = {
  ...livediagramNextConfig({ exportInDev: false }),
  transpilePackages: [
    '@livediagram/ui',
    '@livediagram/api-schema',
    '@liveplanner/ui',
    '@liveplanner/api-schema',
    '@liveworkspace/sites',
    '@liveworkspace/telemetry',
  ],
  ...(process.env.NODE_ENV === 'production'
    ? {}
    : {
        async rewrites() {
          return [
            { source: '/api/auth/:path*', destination: `${ACCOUNTS_DEV}/api/auth/:path*` },
            { source: '/.well-known/:path*', destination: `${ACCOUNTS_DEV}/.well-known/:path*` },
            {
              source: '/api/telemetry/:path*',
              destination: `${TELEMETRY_DEV}/api/telemetry/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
