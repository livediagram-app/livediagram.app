// liveworkspace's Community (liveworkspace/docs/specs/007-community/community.md): one Worker for every app's Community
// listings, on liveworkspace.app/api/community. It hosts no pages: each app serves its own Community
// pages, which read the gallery from here, and each app's own Worker publishes its documents here and
// keeps them in step. The documents themselves never leave their app.

import { API_PATH } from './config';
import { handleApp } from './app-routes';
import { communityEnabled, type Env } from './env';
import { json, notFound, preflight, withCors } from './http';
import { handlePublic } from './public-routes';
import { under } from '@liveworkspace/index-app/worker-http';
import { guardRequest } from '@liveworkspace/api-kit/request-failure';
import { createApiRouteLabel } from '@liveworkspace/telemetry/error-tokens';

// The route words a failure is logged under (`Put.Community.Posts.Like`), never an id.
const routeLabel = createApiRouteLabel(
  new Set(['community']),
  new Set([
    'app',
    'posts',
    'documents',
    'mine',
    'featured',
    'facets',
    'like',
    'report',
    'hidden',
    'copies',
    'copiers',
    'forget',
    'merge',
    'sync',
    'sitemap',
  ]),
);

// App routes are server to server: no browser is ever let in, so no CORS.
const isAppRoute = (pathname: string): boolean =>
  under(pathname, API_PATH) && under(pathname.slice(API_PATH.length), '/app');

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (!under(url.pathname, API_PATH)) return new Response('Not found', { status: 404 });
  const path = url.pathname.slice(API_PATH.length);
  if (isAppRoute(url.pathname)) {
    if (!communityEnabled(env)) return notFound();
    return handleApp(request, env, url, path.slice('/app'.length));
  }
  if (request.method === 'OPTIONS') return preflight(request, env);
  // Switched off, there is no Community to answer for.
  if (!communityEnabled(env)) return withCors(request, env, notFound());
  return withCors(request, env, await handlePublic(request, env, ctx, url, path));
}

const worker = {
  // One guard for the whole request (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails"),
  // its answer with the CORS a public route's answer has.
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return guardRequest(
      () => serve(request, env, ctx),
      () => ({
        route: routeLabel(request.method, request.url),
        json: (body, init) => {
          const res = json(body, init);
          return isAppRoute(new URL(request.url).pathname) ? res : withCors(request, env, res);
        },
      }),
    );
  },
};

export default worker;
