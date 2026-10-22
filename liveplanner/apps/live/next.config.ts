import type { NextConfig } from 'next';
import { liveplannerNextConfig } from '@liveplanner/next-config';

// The shared settings live in @liveplanner/next-config (docs/specs/016-platform/nextjs.md). The editor alone
// exports only its production build: in dev the dynamic-segment route at `/project/[id]` resolves arbitrary
// user-minted ids without enumerating them in `generateStaticParams`; production ships a single placeholder file
// backed by the live worker's path rewrite (docs/specs/007-editor/new-project-route.md).
const nextConfig: NextConfig = {
  // The React Compiler runs here alone: the editor re-renders constantly (docs/specs/016-platform/nextjs.md).
  ...liveplannerNextConfig({ exportInDev: false, reactCompiler: true }),
  // Pages serve at clean root paths (/project, /explorer, /new, ...);
  // the router selects the live app by route (docs/specs/016-platform/router-app.md), so there's no
  // `/live` basePath in the URL any more. Only the bundled `_next`
  // assets keep a `/live` prefix so they don't collide with marketing's
  // `/_next` — the router strips `/live` before forwarding, so the prod
  // worker serves them from `out/_next`. The prefix applies in dev too
  // (Next's dev server serves the prefixed asset paths itself) so the
  // local router (docs/specs/016-platform/router-app.md) can disambiguate `/_next` the same way prod
  // does; standalone `localhost:3102` keeps working either way.
  assetPrefix: '/live',
  transpilePackages: ['@liveplanner/ui', '@liveplanner/project', '@liveplanner/api-schema'],
};

export default nextConfig;
