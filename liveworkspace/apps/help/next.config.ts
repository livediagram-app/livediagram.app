import type { NextConfig } from 'next';
import { liveworkspaceNextConfig } from '@liveworkspace/next-config';
import { withHelpSite } from '@liveworkspace/help-site/next-config';
import { SCOPE } from './lib/scope.generated';

// The one help centre (liveworkspace/docs/specs/017-help/help-centre.md): a static export served under `/help`, its
// articles in MDX, built once per scope by scripts/build-scopes.mjs (the scope is lib/scope.generated.ts). basePath,
// trailing slashes and MDX come from @liveworkspace/help-site, the rest from the shared config.
// HELP_ART_APP tells the shared art kit which app's canvas to draw (livehuddle's tiled floor and sticky notes); All
// Apps leaves it empty. It goes through the shared config's inlineEnv, so the shared env (the footer's year) stays.
const config: NextConfig = withHelpSite({
  ...liveworkspaceNextConfig({ inlineEnv: { HELP_ART_APP: SCOPE === 'all' ? '' : SCOPE } }),
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
