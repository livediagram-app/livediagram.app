// liveworkspace.app's bare domain (liveworkspace/docs/specs/010-site/site.md "www. is the address"). On the route
// `liveworkspace.app/*`, beneath the APIs' more specific routes, so it sees only what the site would have: a page load
// answers one 301 to www. (moving a session from before the move with it, moved-cookies.ts), and everything else goes
// to the site Worker as before. Production only: staging and local development have one host each, and `wrangler dev`
// hands a Worker its route's production host, so DEPLOY_ENV (set on both) passes everything through.
//
// It also answers plain HTTP on www.liveworkspace.app (its route `http://www.liveworkspace.app/*`, HTTP only, so an HTTPS
// visit never runs it) and on the bare domain: one redirect to the same address over HTTPS (site.md "Only over HTTPS").

import { httpsRedirect } from '@liveworkspace/sites/https-redirect';
import { workspaceWwwRedirect } from '@liveworkspace/sites/workspace-proxy';
import { movedCookies } from './moved-cookies';

interface Env {
  // The site Worker (liveworkspace-site), for everything that is not redirected. Absent locally.
  SITE?: Fetcher;
  // Locally, the site's dev server instead.
  SITE_ORIGIN?: string;
  // "staging" or "local": nothing is redirected.
  DEPLOY_ENV?: string;
}

async function toSite(request: Request, env: Env): Promise<Response> {
  if (env.SITE) return env.SITE.fetch(request);
  if (env.SITE_ORIGIN) {
    const url = new URL(request.url);
    const target = new URL(`${url.pathname}${url.search}`, env.SITE_ORIGIN);
    return fetch(new Request(target, request));
  }
  return new Response('redirect: no SITE binding and no SITE_ORIGIN', { status: 503 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const redirect = env.DEPLOY_ENV ? null : workspaceWwwRedirect(request, url);
    if (!redirect) {
      // Anything else over plain HTTP: the same address over HTTPS, before the site is ever asked.
      const https = env.DEPLOY_ENV === 'local' ? null : httpsRedirect(request, url);
      return https ?? toSite(request, env);
    }
    const moved = movedCookies(request.headers.get('Cookie'));
    if (moved.length === 0) return redirect;
    // Moving cookies is this browser's alone: never kept by a cache, and asked again until it has moved.
    const headers = new Headers(redirect.headers);
    headers.set('Cache-Control', 'no-store');
    for (const line of moved) headers.append('Set-Cookie', line);
    return new Response(null, { status: redirect.status, headers });
  },
} satisfies ExportedHandler<Env>;
