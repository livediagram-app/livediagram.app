import type { NextConfig } from 'next';
import { liveworkspaceNextConfig } from '@liveworkspace/next-config';
import { withHelpSite } from '@liveworkspace/help-site/next-config';

// The help centre (docs/specs/018-help/help-app.md): a static export served under `/help` by the router, its articles
// in MDX. basePath, trailing slashes and MDX come from @liveworkspace/help-site, the rest from the shared config
// (docs/specs/016-platform/nextjs.md).
const config: NextConfig = withHelpSite({
  ...liveworkspaceNextConfig(),
  transpilePackages: ['@liveplanner/ui', '@liveworkspace/ui'],
});

export default config;
