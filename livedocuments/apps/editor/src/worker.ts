// Editor app worker. Wraps the static-export assets binding with a
// single path rewrite: any `/document/<anything>` request serves the
// single placeholder HTML built by Next.js, and the client extracts
// the real document id from `window.location.pathname`. See docs/specs/007-editor/new-document-route.md
// for why we can't enumerate user-minted ids at build time.

import { TRUSTED_TYPES_CSP } from '@livedocuments/ui/trusted-types';

type AssetsBinding = { fetch: (request: Request) => Promise<Response> };
// API is optional: the share page's link preview (./share-page.ts) asks it for the document's name, and without it
// the page is served as built.
type Env = { ASSETS: AssetsBinding; API?: Fetcher };

// Defense-in-depth response headers. None of these block existing
// functionality; they shut down whole classes of attack surface that
// the editor doesn't need to expose:
//   - X-Frame-Options DENY: stop the editor being framed inside a
//     malicious site (clickjacking).
//   - X-Content-Type-Options nosniff: stop the browser sniffing a
//     mistyped response into an executable type.
//   - Referrer-Policy strict-origin-when-cross-origin: URLs carry
//     document ids in the path; don't leak full paths to third-party
//     sites the user might click out to.
//   - Permissions-Policy: deny every powerful feature the editor
//     doesn't use (camera / mic / geolocation / payment / USB) so a
//     compromised script can't request them. Clipboard isn't denied
//     because the image picker uses paste; fullscreen=self is
//     allowed for the laser-presenter view.
//   - Strict-Transport-Security: 1-year HSTS with includeSubDomains.
//     Pins the browser to HTTPS for the apex + every subdomain
//     after the first visit; subsequent loads can't be downgraded
//     to plain HTTP by a network-level attacker. Cloudflare's zone-
//     level toggle covers the same ground but this code-side header
//     is the source of truth so self-host deployments inherit it.
//
//   - Content-Security-Policy: Trusted Types alone, enforced
//     (docs/specs/016-platform/trusted-types.md). The rest of a CSP
//     (script-src, the api / R2 origins)
//     is out of that spec's scope.
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': TRUSTED_TYPES_CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function withSecurityHeaders(res: Response, opts?: { frameable?: boolean }): Response {
  // Response headers from the assets binding are immutable when the
  // body is a stream, so we clone into a fresh Response with the
  // merged headers. Status / body pass through.
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) merged.set(k, v);
  // The read-only embed view (docs/specs/013-workspace/embeds.md) is the one path that MUST be
  // frameable by third-party sites; it carries no authenticated
  // actions to clickjack, so dropping the header there doesn't
  // reopen the attack the DENY exists for. Every other route keeps
  // DENY.
  if (opts?.frameable) merged.delete('X-Frame-Options');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const frameable = url.pathname === '/embed' || url.pathname.startsWith('/embed/');
    // /explorer is an index with no content of its own (docs/specs/013-workspace/folders.md):
    // every section lives at /explorer/<section>, default Home
    // (docs/specs/013-workspace/timeline.md §8.1). 302 here so the address bar lands on the real
    // section before any HTML is served; the page's client-side
    // replace covers dev where this worker isn't in front. The
    // Location is a clean (`/live`-free) path — the router selects the
    // editor app for /explorer routes directly (docs/specs/016-platform/router-app.md).
    if (url.pathname === '/explorer' || url.pathname === '/explorer/') {
      return Response.redirect(`${url.origin}${EXPLORER_LANDING_PATH}`, 302);
    }
    // `/document` shares one HTML file. We
    // rewrite the request rather than redirect so the browser URL
    // stays `/document/<id>` (that's the whole point of the path
    // scheme).
    if (isEditorPath(url.pathname)) {
      // Skip if the request already points at the placeholder asset
      // (otherwise we'd loop). Static Assets resolves the extension.
      if (url.pathname !== '/document/placeholder') {
        const rewritten = new URL(request.url);
        rewritten.pathname = '/document/placeholder';
        const shell = () => env.ASSETS.fetch(new Request(rewritten.toString(), request));
        // A share link's page names its document for link previews (docs/specs/013-workspace/share-link-previews.md).
        if (isSharePagePath(url.pathname)) {
          return withSecurityHeaders(await sharePage(request, env.API, shell));
        }
        return withSecurityHeaders(await shell());
      }
    }
    // The workspace frame (docs/specs/013-workspace/workbench-embeds.md "Two scopes"): one static page backs every
    // place inside it, rewritten rather than redirected so the frame keeps its address. Under /embed: frameable.
    if (isWorkspaceFramePath(url.pathname)) {
      const rewritten = new URL(request.url);
      rewritten.pathname = WORKSPACE_FRAME_PAGE;
      return withSecurityHeaders(
        await env.ASSETS.fetch(new Request(rewritten.toString(), request)),
        { frameable: true },
      );
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request), { frameable });
  },
};
import { isEditorPath } from '../lib/editor-path';
import { isWorkspaceFramePath, WORKSPACE_FRAME_PAGE } from '../lib/workbench/workbench-frame-path';
import { EXPLORER_LANDING_PATH } from '../lib/explorer-landing';
import { isSharePagePath, sharePage, type Fetcher } from './share-page';
