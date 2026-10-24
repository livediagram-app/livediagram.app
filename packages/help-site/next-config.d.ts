import type { NextConfig } from 'next';

/** A help app's Next settings: basePath `/help`, trailing slashes, MDX pages with GitHub-flavoured markdown,
 *  and this package transpiled, on top of the config the app passes (the shared one plus its ui package). */
export declare function withHelpSite(config: NextConfig): NextConfig;
