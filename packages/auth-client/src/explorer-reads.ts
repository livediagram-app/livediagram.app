// The Explorer's reads from another app (liveworkspace/docs/one-explorer.md): on an app's own address the Explorer
// asks as that app, with a token addressed to that app's API, yet it draws every app's items, so it asks each item's
// own app for its preview and its tabs. Those two reads, and only those, accept a token addressed to any of the four
// apps' APIs in the same environment, the audiences liveworkspace.app's own token already carries. What the token
// may read is unchanged: the route still checks the person may read the item.

import { APP_SITES } from '@liveworkspace/sites';

// The apps' registered hosts (livediagram.app, …), from the sites registry.
const APP_HOSTS = APP_SITES.map((site) => site.id as string);

/**
 * Every app's API resource in the environment `resource` belongs to: `https://livediagram.app/api` gives the four
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
  const match = /^(staging\.)?(.+)$/.exec(url.host);
  const prefix = match?.[1] ?? '';
  if (!match || !APP_HOSTS.includes(match[2]!)) return [resource];
  return APP_HOSTS.map((host) => `${url.protocol}//${prefix}${host}${url.pathname}`);
}

/** Whether a request is one of the Explorer's reads of an item: `GET /api/<items>/<id>/thumbnail` or `…/tabs`. */
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
    (parts[4] === 'thumbnail' || parts[4] === 'tabs')
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
