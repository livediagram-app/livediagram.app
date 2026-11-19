import type { NextConfig } from 'next';
import { liveworkspaceNextConfig } from '@liveworkspace/next-config';
import { withHelpSite } from '@liveworkspace/help-site/next-config';

// The one help centre (liveworkspace/docs/specs/016-help/help-centre.md): a static export served under `/help`, its
// articles in MDX, built once per scope by scripts/build-scopes.mjs (the scope is lib/scope.generated.ts). basePath,
// trailing slashes and MDX come from @liveworkspace/help-site, the rest from the shared config.
const config: NextConfig = withHelpSite({
  ...liveworkspaceNextConfig(),
  transpilePackages: [
    '@livediagram/ui',
    '@liveplanner/ui',
    '@livedocuments/ui',
    '@livedesign/ui',
    '@livehuddle/ui',
    '@liveworkspace/ui',
  ],
});

export default config;
