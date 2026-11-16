// Plain HTTP goes to HTTPS (liveworkspace/docs/specs/010-site/site.md "Only over HTTPS", docs/specs/016-platform/router-app.md
// "Only over HTTPS" in each app). A visitor who types or follows an http:// link gets one redirect to the same address
// over https://, so the page, its cookies and the Strict-Transport-Security header only ever arrive encrypted. Every
// app's router and liveworkspace's redirect Worker ask this one helper, so the rule cannot drift between them.
//
// Kept dependency-free and Worker-safe (URL, Request, Response only): it runs first in every router.

import { APP_BARE_HOSTS, WORKSPACE_BARE_HOST, WWW_REDIRECT_CACHE_CONTROL } from './workspace-proxy';

/** Every public host that is only served over HTTPS: each app's and liveworkspace.app's bare, www. and staging.
 *  hosts. Local, workers.dev and any other host are never redirected, so local development keeps plain HTTP. */
export const HTTPS_ONLY_HOSTS: ReadonlySet<string> = new Set(
  [...APP_BARE_HOSTS, WORKSPACE_BARE_HOST].flatMap((domain) => [
    domain,
    `www.${domain}`,
    `staging.${domain}`,
  ]),
);

/** Whether Cloudflare says the visitor came over HTTPS (`CF-Visitor: {"scheme":"https"}`), whatever request.url says.
 *  A guard against a loop should the edge ever hand a Worker a rewritten http:// URL for an HTTPS visit. */
function visitorUsedHttps(request: Request): boolean {
  const visitor = request.headers.get('CF-Visitor');
  if (!visitor) return false;
  try {
    return (JSON.parse(visitor) as { scheme?: unknown }).scheme === 'https';
  } catch {
    return false;
  }
}

/** A plain-HTTP request to one of HTTPS_ONLY_HOSTS: a redirect to the same host, path and query over https:// on the
 *  default port, kept for a day as the bare domain's redirect is. `301` for a GET or HEAD (a WebSocket upgrade over ws:// included: a browser refuses one from an
 *  HTTPS page anyway), `308` for any other method, so a POST stays a POST with its body. Null for an HTTPS request,
 *  any other host, or a visit Cloudflare marks as HTTPS. */
export function httpsRedirect(request: Request, url: URL): Response | null {
  if (url.protocol !== 'http:') return null;
  if (!HTTPS_ONLY_HOSTS.has(url.hostname)) return null;
  if (visitorUsedHttps(request)) return null;
  const to = new URL(url);
  to.protocol = 'https:';
  to.port = '';
  const safe = request.method === 'GET' || request.method === 'HEAD';
  // Built by hand: Response.redirect's headers are immutable.
  return new Response(null, {
    status: safe ? 301 : 308,
    headers: { Location: to.toString(), 'Cache-Control': WWW_REDIRECT_CACHE_CONTROL },
  });
}
