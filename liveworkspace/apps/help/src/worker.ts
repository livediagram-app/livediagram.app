// The one help centre's Worker (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The Worker"): the scope
// from the x-help-app header (else All Apps), the redirect map and the canonical 308s from dist/manifest.json, then
// the scope's static file. Exports only its default handler (a named export stops workerd); the logic is
// src/help-scope.ts.
import { answer, isStagingHost, scopeOf, withHelpHeaders, type HelpManifest } from './help-scope';

interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

let manifest: Promise<HelpManifest> | null = null;

function loadManifest(env: Env, origin: string): Promise<HelpManifest> {
  manifest ??= env.ASSETS.fetch(`${origin}/manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`[help] manifest.json: ${r.status}`);
    return r.json() as Promise<HelpManifest>;
  });
  manifest.catch(() => {
    manifest = null;
  });
  return manifest;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const url = new URL(request.url);
    const scope = scopeOf(request);
    const found = answer(await loadManifest(env, url.origin), scope, url.pathname, url.search, {
      staging: isStagingHost(url.host),
    });
    if (found.kind === 'redirect')
      return withHelpHeaders(new Response(null, { status: 308, headers: { Location: found.location } }));
    const asset = await env.ASSETS.fetch(new Request(new URL(found.path, url.origin), request));
    if (asset.status !== 404) return withHelpHeaders(asset);
    // The scope's own not-found page, with its status.
    const notFound = await env.ASSETS.fetch(new URL(`/${scope}/404.html`, url.origin).toString());
    return withHelpHeaders(new Response(notFound.body, { status: 404, headers: notFound.headers }));
  },
};
