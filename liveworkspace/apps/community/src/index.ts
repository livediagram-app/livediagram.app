// liveworkspace's Community (liveworkspace/docs/community.md): one Worker for every app's Community
// listings, on liveworkspace.app/api/community. It hosts no pages: each app serves its own Community
// pages, which read the gallery from here, and each app's own Worker publishes its documents here and
// keeps them in step. The documents themselves never leave their app.

import { API_PATH } from './config';
import { handleApp } from './app-routes';
import { communityEnabled, type Env } from './env';
import { notFound, preflight, withCors } from './http';
import { handlePublic } from './public-routes';

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!under(url.pathname, API_PATH)) return new Response('Not found', { status: 404 });
    const path = url.pathname.slice(API_PATH.length);
    // App routes are server to server: no browser is ever let in, so no CORS.
    if (under(path, '/app')) {
      if (!communityEnabled(env)) return notFound();
      return handleApp(request, env, url, path.slice('/app'.length));
    }
    if (request.method === 'OPTIONS') return preflight(request, env);
    // Switched off, there is no Community to answer for.
    if (!communityEnabled(env)) return withCors(request, env, notFound());
    return withCors(request, env, await handlePublic(request, env, ctx, url, path));
  },
};

export default worker;
