// The Explorer's reads from another app (liveworkspace/docs/specs/004-index/one-explorer.md): on an app's own address the Explorer
// asks as that app, with a token addressed to that app's API, yet it draws every app's items, so it asks each item's
// own app for its tabs (the Share dialog's tab picker). That read, and only that, accepts a token addressed to any of
// the four apps' APIs in the same environment, the audiences liveworkspace.app's own token already carries. What the
// token may read is unchanged: the route still checks the person may read the item. Previews are no app's any more:
// they are liveworkspace's (liveworkspace/docs/specs/006-media/previews.md), behind the index, which takes every app's token.

import { APP_SITES, STAND_INS, type AppSiteId } from '@liveworkspace/sites';

// Each app's API host per environment, from the sites registry: `livediagram.app` and `staging.livediagram.app`, or
// the app's workers.dev stand-ins while its domain is elsewhere (livediagram/docs/specs/016-platform/stand-in-addresses.md).
const APP_API_HOSTS = (['production', 'staging'] as const).map((environment) =>
  APP_SITES.map((site) => {
    const standIn = STAND_INS[site.id as AppSiteId];
    if (standIn) return new URL(standIn[environment]).host;
    return environment === 'staging' ? `staging.${site.id}` : site.id;
  }),
);

/**
 * Every app's API resource in the environment `resource` belongs to: `https://liveplanner.app/api` gives the four
 * production resources, `https://staging.liveplanner.app/api` the four staging ones. Any other resource (local
 * development's one shared `http://localhost/api`) is the only one.
 */
export function appApiResources(resource: string): string[] {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    return [resource];
  }
  const hosts = APP_API_HOSTS.find((list) => list.includes(url.host));
  if (!hosts) return [resource];
  return hosts.map((host) => `${url.protocol}//${host}${url.pathname}`);
}

/** Whether a request is the Explorer's read of an item's tabs: `GET /api/<items>/<id>/tabs`. */
export function isExplorerRead(request: Request, itemsSegment: string): boolean {
  if (request.method !== 'GET') return false;
  const path = new URL(request.url).pathname;
  const parts = path.split('/');
  return (
    parts.length === 5 &&
    parts[0] === '' &&
    parts[1] === 'api' &&
    parts[2] === itemsSegment &&
    parts[3] !== '' &&
    parts[4] === 'tabs'
  );
}

/** The audiences a request's token may carry: every app's for the Explorer's reads, else this API's own. */
export function audiencesFor(
  request: Request,
  resource: string,
  itemsSegment: string,
): string | string[] {
  return isExplorerRead(request, itemsSegment) ? appApiResources(resource) : resource;
}
