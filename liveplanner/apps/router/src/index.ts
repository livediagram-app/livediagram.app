// liveplanner's router (docs/specs/016-platform/router-app.md): the one every app runs (@liveworkspace/sites/app-router),
// bound to this app's name, its editor's routes, its help categories and what else is its own.

import { LIVE_ROUTE_SEGMENTS, SIGNED_IN_HINT_COOKIE } from '@liveplanner/api-schema';
import { routeCommunity } from '@liveworkspace/community-site/router';
import { createOEmbed } from '@liveworkspace/media/oembed';
import { siteOfApp } from '@liveworkspace/sites';
import {
  type AppRouterEnv,
  createAppRouter,
  telemetryRedirectTo,
} from '@liveworkspace/sites/app-router';
import { TELEMETRY_DASHBOARD_URL } from '@liveworkspace/telemetry';

export interface Env extends AppRouterEnv {
  // The editor Worker: a service binding in production, an origin in local dev.
  EDITOR?: Fetcher;
  EDITOR_ORIGIN?: string;
  // The central telemetry dashboard /telemetry redirects to (liveworkspace/docs/specs/008-telemetry/telemetry.md): unset means
  // production's, staging and local dev name their own.
  TELEMETRY_DASHBOARD_URL?: string;
}

export default createAppRouter<Env, Parameters<typeof routeCommunity>[1]['site']>({
  app: 'liveplanner',
  liveRouteSegments: LIVE_ROUTE_SEGMENTS,
  signedInCookie: SIGNED_IN_HINT_COOKIE,
  // Pinned to the help registry's own categories by index.test.ts.
  helpCategorySegments: [
    'about',
    'account-and-data',
    'collaboration',
    'contact',
    'developers',
    'getting-started',
    'plan',
    'policies',
    'privacy-and-security',
    'search-panel',
    'supported-devices',
    'tabs',
    'tips-and-tricks',
    'tools',
    'troubleshooting',
    'user-interface',
  ],
  editorBinding: (env) => env.EDITOR,
  editorOrigin: (env) => env.EDITOR_ORIGIN,
  oembed: createOEmbed({ app: 'liveplanner', untitled: 'Untitled plan' }),
  routeCommunity,
  communitySite: {
    app: 'liveplanner.app',
    siteUrl: siteOfApp('liveplanner').url,
    product: 'liveplanner',
    nouns: 'plans',
  },
  telemetryRedirect: (env) =>
    telemetryRedirectTo(env.TELEMETRY_DASHBOARD_URL || TELEMETRY_DASHBOARD_URL, 'liveplanner.app'),
}) satisfies ExportedHandler<Env>;
