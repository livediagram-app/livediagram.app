// livediagram's router (docs/specs/016-platform/router-app.md): the one every app runs (@liveworkspace/sites/app-router),
// bound to this app's name, its editor's routes, its help categories and what else is its own.

import { LIVE_ROUTE_SEGMENTS, SIGNED_IN_HINT_COOKIE } from '@livediagram/api-schema';
import {
  legacyEditorRedirect,
  legacyFormRedirect,
  legacyHelpRedirect,
} from './legacy-editor-route';
import { routeCommunity } from '@liveworkspace/community-site/router';
import { createOEmbed } from '@liveworkspace/media/oembed';
import { siteOfApp } from '@liveworkspace/sites';
import {
  type AppRouterEnv,
  createAppRouter,
  telemetryDashboardUrlFor,
} from '@liveworkspace/sites/app-router';

export interface Env extends AppRouterEnv {
  // The editor Worker: a service binding in production, an origin in local dev.
  EDITOR?: Fetcher;
  EDITOR_ORIGIN?: string;
}

export default createAppRouter<Env, Parameters<typeof routeCommunity>[1]['site']>({
  app: 'livediagram',
  liveRouteSegments: LIVE_ROUTE_SEGMENTS,
  signedInCookie: SIGNED_IN_HINT_COOKIE,
  // Pinned to the help registry's own categories by index.test.ts.
  helpCategorySegments: [
    'about',
    'account-and-data',
    'canvas',
    'collaboration',
    'contact',
    'developers',
    'getting-started',
    'palette',
    'policies',
    'privacy-and-security',
    'search-panel',
    'selection-modes',
    'supported-devices',
    'tabs',
    'tips-and-tricks',
    'tools',
    'troubleshooting',
    'user-interface',
  ],
  editorBinding: (env) => env.EDITOR,
  editorOrigin: (env) => env.EDITOR_ORIGIN,
  oembed: createOEmbed({ app: 'livediagram', untitled: 'Untitled canvas' }),
  routeCommunity,
  communitySite: {
    app: 'livediagram.app',
    siteUrl: siteOfApp('livediagram').url,
    product: 'livediagram',
    nouns: 'canvases',
  },
  telemetryRedirect: (env) =>
    Response.redirect(telemetryDashboardUrlFor(env.DEPLOY_ENV, 'livediagram.app'), 301),
  // Old addresses: an old form link (forms are liveplanner's now), and the help and editor paths that moved.
  legacy: { form: legacyFormRedirect, help: legacyHelpRedirect, editor: legacyEditorRedirect },
}) satisfies ExportedHandler<Env>;
